import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as servicecatalog from 'aws-cdk-lib/aws-servicecatalog';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as fs from 'fs';
import * as path from 'path';

export class Cicd03ServicecatalogProductStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define the Service Catalog Portfolio
    const portfolio = new servicecatalog.Portfolio(this, 'CICDPortfolio', {
      displayName: 'CI/CD Pipeline Portfolio',
      providerName: 'YourCompany',
      description: 'Portfolio for CI/CD Pipelines',
    });

    // Load the CloudFormation template for the product
    const templatePath = path.join(__dirname, '../templates/cicd_codepipeline.yaml');
    const productTemplate = fs.readFileSync(templatePath, 'utf8');

    // Define the Service Catalog Product
    const product = new servicecatalog.CloudFormationProduct(this, 'CICDProduct', {
      productName: 'CI/CD Pipeline Product',
      owner: 'YourCompany',
      description: 'A CI/CD pipeline using CodePipeline and CodeBuild',
      productVersions: [
        {
          productVersionName: 'v1',
          cloudFormationTemplate: servicecatalog.CloudFormationTemplate.fromAsset(templatePath),
        },
      ],
    });

    // Add the product to the portfolio
    portfolio.addProduct(product);

    // Add IAM role for portfolio administration (optional)
    const adminRole = new iam.Role(this, 'PortfolioAdminRole', {
      assumedBy: new iam.AccountRootPrincipal(),
    });

    portfolio.giveAccessToRole(adminRole);
  }
}

const app = new cdk.App();
new Cicd03ServicecatalogProductStack(app, 'Cicd03ServicecatalogProductStack');
