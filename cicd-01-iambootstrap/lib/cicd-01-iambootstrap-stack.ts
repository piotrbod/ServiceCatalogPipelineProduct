import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export class Cicd01IambootstrapStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const administrationRoleName = 'AWSCloudFormationStackSetAdministrationRole';
    const executionRoleName = 'AWSCloudFormationStackSetExecutionRole';

    const administrationRole = new iam.Role(this, 'AdministrationRole', {
      roleName: administrationRoleName,
      assumedBy: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
    });

    administrationRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [`arn:*:iam::*:role/${executionRoleName}`],
      })
    );
  }
}
