import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';

export class Cicd02PipelineTemplatesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Define GitHub parameters
    const githubOwner = new cdk.CfnParameter(this, 'GitHubOwner', {
      type: 'String',
      description: 'GitHub owner/organization name',
    });

    const githubRepo = new cdk.CfnParameter(this, 'GitHubRepo', {
      type: 'String',
      description: 'GitHub repository name',
    });

    const githubBranch = new cdk.CfnParameter(this, 'GitHubBranch', {
      type: 'String',
      default: 'main',
      description: 'GitHub branch name',
    });

    // Parameter for GitHub token
    const githubToken = new cdk.CfnParameter(this, 'GitHubToken', {
      type: 'String',
      description: 'GitHub Personal Access Token',
      noEcho: true,  // This ensures the token is not displayed in plain text in the console
    });

    // Parameter for API URL
    const apiUrl = new cdk.CfnParameter(this, 'APIUrl', {
      type: 'String',
      description: 'Base URL for the API',
    });

    // Parameter for employer ID
    const employerId = new cdk.CfnParameter(this, 'EmployerId', {
      type: 'String',
      description: 'Employer ID for the API test',
    });
    
    // Create the Secrets Manager secret with an automatically generated name
    const githubTokenSecret = new secretsmanager.Secret(this, 'GitHubTokenSecret', {
      secretStringValue: cdk.SecretValue.unsafePlainText(githubToken.valueAsString),
    });

    // Create an administrative role
    const adminRole = new iam.Role(this, 'AdminRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
      ],
    });

    // Create the CodeBuild role
    const codeBuildRole = new iam.Role(this, 'CodeBuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description: 'Role assumed by CodeBuild for build operations',
    });

    codeBuildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject'],
        resources: [`arn:aws:s3:::cdk-*-assets-${this.account}-${this.region}/*`],
      })
    );

    // Add CloudFormation permissions
    codeBuildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudformation:DescribeStacks',
          'cloudformation:ListStackResources',
          'cloudformation:GetTemplate'
        ],
        resources: [`arn:aws:cloudformation:${this.region}:${this.account}:stack/*`],
      })
    );

    // Add IAM PassRole permissions
    codeBuildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['iam:PassRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*-cfn-exec-role-${this.account}-${this.region}`],
      })
    );

    // Attach policies to the role
    codeBuildRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'));
    codeBuildRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess'));

    
    // Create an IAM role for CodePipeline with permissions to access Secrets Manager
    const pipelineRole = new iam.Role(this, 'PipelineRole', {
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
    });

    pipelineRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:CreateSecret',
        'secretsmanager:UpdateSecret',
        'secretsmanager:DeleteSecret',
      ],
      resources: [
        githubTokenSecret.secretArn,
      ],
    }));

    // Create a CodeBuild project for the build stage
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      role: adminRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromCodeBuildImageId('aws/codebuild/standard:7.0'),
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        environment: {
          buildImage: {
            type: codebuild.ImagePullPrincipalType.CODEBUILD,
            defaultComputeType: codebuild.ComputeType.MEDIUM,
          },
        },
        phases: {
          install: {
            commands: [
              'echo Installing dependencies...',
              'node --version',
              'npm --version',
              'npm install',
            ],
          },
          build: {
            commands: [
              'echo Building the application...',
              'node --version',
              'npm --version',
              'npm run build',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed.',
              'node --version',
              'npm --version',
            ],
          },
        },
        artifacts: {
          files: '**/*',
        },
      }),
    });

    // Create a CodeBuild project for the deploy to staging stage
    const deployStagingProject = new codebuild.PipelineProject(this, 'DeployStagingProject', {
      role: adminRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromCodeBuildImageId('aws/codebuild/standard:7.0'),
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              'echo Installing AWS CDK...',
              'node --version',
              'npm --version',
              'npm install -g aws-cdk',
            ],
          },
          build: {
            commands: [
              'echo Deploying to staging...',
              'node --version',
              'npm --version',
              'rm -rf node_modules',
              'npm install',
              'ls -la',
              'cdk deploy --require-approval never --context environment=staging', // Deploy to staging environment
            ],
          },
        },
        artifacts: {
          files: '**/*',
        },
      }),
    });
    
    // Create a CodeBuild project for the test stage
    const testProject = new codebuild.PipelineProject(this, 'TestProject', {
      role: adminRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromCodeBuildImageId('aws/codebuild/standard:7.0'),
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        environment: {
          buildImage: {
            type: codebuild.ImagePullPrincipalType.CODEBUILD,
            defaultComputeType: codebuild.ComputeType.MEDIUM,
            environmentVariables: {
              API_URL: { value: apiUrl.valueAsString },
              EMPLOYER_ID: { value: employerId.valueAsString },
            },
          },
        },
        phases: {
          install: {
            commands: [
              'echo Installing dependencies...',
              'node --version',
              'npm --version',
              'npm install',
              'npm install mocha axios ts-node', // Install Mocha, Axios, and ts-node
            ],
          },
          build: {
            commands: [
              'echo Running integration tests...',
              'aws s3 cp s3://cdk-hnb659fds-assets-227392978404-us-east-1/test/integration test/integration',
              'ls -la',
              'ls -la test/integration',
              'npx mocha -r ts-node/register test/integration/api.test.ts', // Run the integration test
            ],
          },
        },
        artifacts: {
          files: '**/*',
        },
      }),
    });
    
    // Create a CodeBuild project for the deploy to production stage
    const deployProductionProject = new codebuild.PipelineProject(this, 'DeployProductionProject', {
      role: adminRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromCodeBuildImageId('aws/codebuild/standard:7.0'),
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        environment: {
          buildImage: {
            type: codebuild.ImagePullPrincipalType.CODEBUILD,
            defaultComputeType: codebuild.ComputeType.MEDIUM,
          },
        },
        phases: {
          install: {
            commands: [
              'echo Installing AWS CDK...',
              'node --version',
              'npm --version',
              'npm install -g aws-cdk',
              'npm install',
            ],
          },
          build: {
            commands: [
              'echo Deploying to production...',
              'node --version',
              'npm --version',
              'cdk deploy --require-approval never --context environment=production', // Deploy to production environment
            ],
          },
        },
        artifacts: {
          files: '**/*',
        },
      }),
    });

    // Create the pipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'MyPipeline',
      role: pipelineRole, // Attach the role to the pipeline
      pipelineType: codepipeline.PipelineType.V2, // Set the pipeline type to V2
    });

    // Add source stage
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: githubOwner.valueAsString,
      repo: githubRepo.valueAsString,
      oauthToken: githubTokenSecret.secretValue, // Retrieve the secret value securely
      output: sourceOutput,
      branch: githubBranch.valueAsString,
    });

    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    // Add build stage
    const buildOutput = new codepipeline.Artifact();
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    // Add deploy to staging stage
    pipeline.addStage({
      stageName: 'DeployToStaging',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'DeployToStaging',
          project: deployStagingProject,
          input: buildOutput,
        }),
      ],
    });

    // Add test stage
    pipeline.addStage({
      stageName: 'Test',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Test',
          project: testProject,
          input: buildOutput,
        }),
      ],
    });

    // Add deploy to production stage
    pipeline.addStage({
      stageName: 'DeployToProduction',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'DeployToProduction',
          project: deployProductionProject,
          input: buildOutput,
        }),
      ],
    });    
  }
}
