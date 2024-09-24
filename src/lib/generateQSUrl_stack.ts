import {
  aws_lambda as lambda,
  aws_iam as iam,
  aws_apigateway as apigateway,
  aws_cognito as cognito,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Stack, StackProps, CfnOutput, Duration } from "aws-cdk-lib";

export class GenerateQSUrlStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    userPool: cognito.UserPool,
    userPoolClient: string,
    props?: StackProps
  ) {
    super(scope, id, props);

    // Define the IAM role for the Lambda function
    const lambdaRole = new iam.Role(this, "GenerateQSUrlLambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    // Example of adding an inline policy for additional permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "quicksight:GenerateEmbedUrlForRegisteredUser",
          "quicksight:DescribeUser",
        ], // Example action
        resources: ["*"], // Specify resources as needed
      })
    );

    // Define a new Lambda resource with the explicit role
    const generateDashboardUrlFunc = new lambda.Function(
      this,
      "BackendHandler",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        code: lambda.Code.fromAsset("src/lambda-code/QSaccess"),
        handler: "generateDashboardUrl.generateDashboardUrl",
        role: lambdaRole, // Use the explicitly defined role
        environment: {
          AWS_ACC_ID: this.account,
          USER_POOL_CLIENT_ID: userPoolClient, //the-app-clientid
          REGION: this.region,
          USER_POOL_ID: userPool.userPoolId,
        },
        timeout: Duration.minutes(1),
      }
    );

    // Define the API Gateway
    const api = new apigateway.RestApi(this, "QSUrlApi", {
      restApiName: "QS Generate Url API",
      description: "API to generate Quicksight URL",
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "UserAuthorizer",
      {
        cognitoUserPools: [userPool],
      }
    );

    // Lambda Integration
    const lambdaIntegration = new apigateway.LambdaIntegration(
      generateDashboardUrlFunc,
      {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' },
      }
    );

    // Define a new resource and method with Cognito Authorizer
    const loginResource = api.root.addResource("dashboard");
    loginResource.addMethod("GET", lambdaIntegration, {
      authorizer: authorizer,
    });

    // Output API Gateway Endpoint
    new CfnOutput(this, "QSGenerateApiUrl", {
      value: api.url,
      description: "The URL to generate Quicksight URL",
    });
  }
}
