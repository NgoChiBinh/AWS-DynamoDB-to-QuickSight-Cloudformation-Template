import {
  aws_lambda as lambda,
  aws_iam as iam,
  aws_apigateway as apigateway,
  aws_cognito as cognito,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Stack, StackProps, CfnOutput, Duration } from "aws-cdk-lib";

export class AuthStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    userPool: cognito.UserPool,
    userPoolClient: string,
    props?: StackProps
  ) {
    super(scope, id, props);

    // Define a new Lambda resource with the explicit role
    const loginFunc = new lambda.Function(this, "BackendHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("src/lambda-code/auth"),
      handler: "authenticateUserAndFetchToken.authenticateUserAndFetchToken",
      environment: {
        AWS_ACC_ID: this.account,
        USER_POOL_CLIENT_ID: userPoolClient, //the-app-clientid
        REGION: this.region,
        USER_POOL_ID: userPool.userPoolId,
      },
      timeout: Duration.minutes(1),
    });

    // Grant permissions to the Lambda function
    loginFunc.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:InitiateAuth",
          "cognito-idp:RespondToAuthChallenge",
        ],
        resources: [userPool.userPoolArn],
      })
    );

    // Define the API Gateway
    const api = new apigateway.RestApi(this, "UserApi", {
      restApiName: "Login API",
      description: "API to handle user login and return dashboard URL",
    });

    // Lambda Integration
    const lambdaIntegration = new apigateway.LambdaIntegration(loginFunc, {
      requestTemplates: { "application/json": '{ "statusCode": "200" }' },
    });

    // Define a new resource and method with Cognito Authorizer
    const loginResource = api.root.addResource("login");
    loginResource.addMethod("POST", lambdaIntegration);

    // Output API Gateway Endpoint
    new CfnOutput(this, "LoginApiUrl", {
      value: api.url + "login",
      description:
        "The URL to call for user login and retrieving the dashboard URL",
    });
    
  }
}
