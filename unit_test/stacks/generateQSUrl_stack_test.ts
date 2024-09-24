const cdk = require("aws-cdk-lib");
const { Template, Match } = require("aws-cdk-lib/assertions");
const { GenerateQSUrlStack } = require("../../src/lib/generateQSUrl_stack");
const cognito = require("aws-cdk-lib/aws-cognito");

test("GenerateQSUrlStack creates necessary resources", () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "TestStack");

  // Create the User Pool within the scope of a Stack
  const userPool = new cognito.UserPool(stack, "TestUserPool");
  const userPoolClient = "test-client-id";

  // Instantiate the GenerateQSUrlStack
  const generateQSUrlStack = new GenerateQSUrlStack(
    stack,
    "TestGenerateQSUrlStack",
    userPool,
    userPoolClient
  );

  // Generate the CloudFormation template for the GenerateQSUrlStack
  const template = Template.fromStack(generateQSUrlStack);

  // Check if Lambda function is created
  template.hasResourceProperties("AWS::Lambda::Function", {
    Handler: "generateDashboardUrl.generateDashboardUrl",
    Runtime: "nodejs18.x",
    Timeout: 60,
    Environment: {
      Variables: {
        AWS_ACC_ID: { Ref: "AWS::AccountId" },
        REGION: { Ref: "AWS::Region" },
        USER_POOL_CLIENT_ID: userPoolClient,
        USER_POOL_ID: {
          "Fn::ImportValue":
            "TestStack:ExportsOutputRefTestUserPool83C2ABD0528647F1",
        },
      },
    },
  });

  // Check if IAM Role Policy has necessary actions
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: [
            "quicksight:GenerateEmbedUrlForRegisteredUser",
            "quicksight:DescribeUser",
          ],
          Effect: "Allow",
          Resource: "*",
        }),
      ]),
    },
  });

  // Check if API Gateway is created
  template.hasResourceProperties("AWS::ApiGateway::RestApi", {
    Name: "QS Generate Url API",
    Description: "API to generate Quicksight URL",
  });

  // Check if API Gateway resource and method are created
  template.hasResourceProperties("AWS::ApiGateway::Method", {
    HttpMethod: "GET",
    AuthorizationType: "COGNITO_USER_POOLS",
    AuthorizerId: {
      Ref: "UserAuthorizerF623B8DE",
    },
    Integration: {
      IntegrationHttpMethod: "POST",
      RequestTemplates: {
        "application/json": '{ "statusCode": "200" }',
      },
      Type: "AWS_PROXY",
      Uri: {
        "Fn::Join": [
          "",
          [
            "arn:",
            {
              Ref: "AWS::Partition",
            },
            ":apigateway:",
            {
              Ref: "AWS::Region",
            },
            ":lambda:path/2015-03-31/functions/",
            {
              "Fn::GetAtt": ["BackendHandler4504EC6C", "Arn"],
            },
            "/invocations",
          ],
        ],
      },
    },
    ResourceId: {
      Ref: "QSUrlApidashboard4C63F64F",
    },
    RestApiId: {
      Ref: "QSUrlApi5E585DCB",
    },
  });

  // Check if CfnOutput for API Gateway URL is created
  template.hasOutput("QSGenerateApiUrl", {
    Description: "The URL to generate Quicksight URL",
  });
});
