import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

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

    // Create the Secrets Manager secret with an automatically generated name
    const githubTokenSecret = new secretsmanager.Secret(this, 'GitHubTokenSecret', {
      secretStringValue: cdk.SecretValue.unsafePlainText(githubToken.valueAsString),
    });
    
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

    // Create a CodeBuild project with an inline buildspec
    const project = new codebuild.PipelineProject(this, 'MyProject', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              'echo Installing dependencies...',
              'npm install',
            ],
          },
          build: {
            commands: [
              'echo Building the application...',
              'npm run build',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed.',
            ],
          },
        },
        artifacts: {
          files: '**/*',
          'discard-paths': 'yes',
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
      },
    });

    // Create the pipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'MyPipeline',
      role: pipelineRole, // Attach the role to the pipeline
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
          project,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });
  }
}
