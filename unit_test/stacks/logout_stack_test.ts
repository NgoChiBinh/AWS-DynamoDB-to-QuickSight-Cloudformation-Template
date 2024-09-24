import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { LogoutStack } from '../../src/lib/logout_stack'; // Adjust the path according to your project structure
import * as cognito from 'aws-cdk-lib/aws-cognito';

describe('LogoutStack', () => {
  const app = new cdk.App();

  // Create a mock stack to contain the UserPool
  const mockStack = new cdk.Stack(app, 'MockStack');

  // Mock Cognito UserPool
  const userPool = new cognito.UserPool(mockStack, 'TestUserPool', {
    userPoolName: 'TestUserPool',
  });

  // Instantiate the LogoutStack with the mock UserPool
  const stack = new LogoutStack(app, 'LogoutStack', userPool, 'TestUserPoolClient');

  // Prepare the CDK Template
  const template = Template.fromStack(stack);

  test('Lambda Function Created', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'logout.handler',
      Runtime: 'nodejs18.x',
    });
  });

  test('IAM Policy for Cognito GlobalSignOut', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'cognito-idp:GlobalSignOut',
            Effect: 'Allow',
            Resource: stack.resolve(userPool.userPoolArn),
          },
        ],
      },
    });
  });

  test('API Gateway Created', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'Cognito Logout API',
    });
  });

  test('API Gateway Lambda Integration', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST',
      ResourceId: {
        Ref: "LogoutApilogout2BF95BC9", // Adjusted to match your synthesized template
      },
      AuthorizationType: 'NONE',
    });
  });

  test('CfnOutput for API URL', () => {
    template.hasOutput('LogoutApiUrl', {
      Description: 'The URL for the Cognito Logout API',
    });
  });
});
