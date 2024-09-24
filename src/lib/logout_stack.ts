import {
  aws_lambda as lambda,
  aws_iam as iam,
  aws_apigateway as apigateway,
  aws_cognito as cognito,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Stack, StackProps, CfnOutput, Duration } from "aws-cdk-lib";

export class LogoutStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    userPool: cognito.UserPool,
    userPoolClient: string,
    props?: StackProps
  ) {
    super(scope, id, props);

    // Define the Lambda function
    const logoutFunction = new lambda.Function(this, "LogoutHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("src/lambda-code/auth"),
      handler: "logout.handler",
      environment: {
        REGION: this.region,
      },
    });

    logoutFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:GlobalSignOut"],
        resources: [userPool.userPoolArn],
      })
    );

    // Define the API Gateway
    const api = new apigateway.RestApi(this, "LogoutApi", {
      restApiName: "Cognito Logout API",
      description: "API to log out users from Cognito",
    });

    // Lambda Integration
    const lambdaIntegration = new apigateway.LambdaIntegration(logoutFunction, {
      requestTemplates: { "application/json": '{ "statusCode": "200" }' },
    });

    // Define a resource and method for logout
    const logoutResource = api.root.addResource("logout");
    logoutResource.addMethod("POST", lambdaIntegration);

    // Output API Gateway Endpoint
    new CfnOutput(this, "LogoutApiUrl", {
      value: api.url,
      description: "The URL for the Cognito Logout API",
    });
  }
}
