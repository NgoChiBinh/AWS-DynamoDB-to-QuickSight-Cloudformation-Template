import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../../src/lib/auth_stack';
import * as cognito from 'aws-cdk-lib/aws-cognito';

test('AuthStack creates necessary resources', () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');

  // Create the User Pool within the scope of a Stack
  const userPool = new cognito.UserPool(stack, 'TestUserPool');
  const userPoolClient = 'test-client-id';

  // Instantiate the AuthStack
  const authStack = new AuthStack(stack, 'TestAuthStack', userPool, userPoolClient);

  // Generate the CloudFormation template for the AuthStack
  const template = Template.fromStack(authStack);

  // Check if Lambda function is created
  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'authenticateUserAndFetchToken.authenticateUserAndFetchToken',
    Runtime: 'nodejs18.x',
    Timeout: 60,
    Environment: {
      Variables: {
        AWS_ACC_ID: { Ref: 'AWS::AccountId' },
        USER_POOL_CLIENT_ID: userPoolClient,
        REGION: { Ref: 'AWS::Region' },
        USER_POOL_ID: {
          'Fn::ImportValue': 'TestStack:ExportsOutputRefTestUserPool83C2ABD0528647F1'
        }
      }
    }
  });

  // Check if IAM Role Policy has necessary actions
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: [
            'cognito-idp:InitiateAuth',
            'cognito-idp:RespondToAuthChallenge'
          ],
          Effect: 'Allow',
          Resource: {
            'Fn::ImportValue': 'TestStack:ExportsOutputFnGetAttTestUserPool83C2ABD0Arn49F3624D'
          }
        })
      ])
    }
  });

  // Check if API Gateway is created
  template.hasResourceProperties('AWS::ApiGateway::RestApi', {
    Name: 'Login API',
    Description: 'API to handle user login and return dashboard URL'
  });

  // Check if API Gateway resource and method are created
  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'POST',
    AuthorizationType: 'NONE',
    Integration: {
      IntegrationHttpMethod: 'POST',
      RequestTemplates: {
        'application/json': '{ "statusCode": "200" }'
      },
      Type: 'AWS_PROXY',
      Uri: {
        'Fn::Join': [
          '',
          [
            'arn:',
            { Ref: 'AWS::Partition' },
            ':apigateway:',
            { Ref: 'AWS::Region' },
            ':lambda:path/2015-03-31/functions/',
            { 'Fn::GetAtt': ['BackendHandler4504EC6C', 'Arn'] },
            '/invocations'
          ]
        ]
      }
    },
    ResourceId: { Ref: 'UserApiloginFA4A60F3' },
    RestApiId: { Ref: 'UserApiB6C12381' }
  });

  // Check if CfnOutput for API Gateway URL is created
  template.hasOutput('LoginApiUrl', {
    Description: 'The URL to call for user login and retrieving the dashboard URL'
  });
});
