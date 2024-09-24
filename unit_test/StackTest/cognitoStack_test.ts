import { App } from 'aws-cdk-lib';
import { Capture, Match, Template } from 'aws-cdk-lib/assertions';
import { CognitoStack } from '../../src/lib/cognito_stack'; 

  describe('CognitoStack', () => {
    const app = new App();
    const cognitoStack = new CognitoStack(app, 'CognitoStack', {
      env: { 
        account: '891377270638', 
        region: 'ap-southeast-1',    
      }
    });

  const template = Template.fromStack(cognitoStack);
  const authenticatedRoleCapture = new Capture(); // Dynamically capture logical ID ref of Authenticated Role

  test('User Pool Created with Correct Configuration', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'TenantUserPool',
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: true, 
      },
      AutoVerifiedAttributes: ['email'], 
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
          RequireUppercase: true,
        },
      },
      Schema: [
        {
          Mutable: true,
          Name: 'email',
          Required: true,
        },
      ],
      AliasAttributes: [
        'email'
      ],
    });
  });

  test('User Pool Client Created with Correct User Pool', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      UserPoolId: { Ref: 'UserPool6BA7E5F2' }, // Check the logical ID from your template
      ClientName: 'NuoaQuicksight',
      //more properties
    });
  });

  test('Identity Pool Authenticated Role Created', () => {
      // Check the IAM role creation
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Federated: 'cognito-identity.amazonaws.com',
              },
              Action: 'sts:AssumeRoleWithWebIdentity',
              Condition: {
                StringEquals: {
                  'cognito-identity.amazonaws.com:aud': {
                    Ref: 'TenantIdentityPool',
                  },
                },
                'ForAnyValue:StringLike': {
                  'cognito-identity.amazonaws.com:amr': 'authenticated',
                },
              },
            },
          ],
        },
        Description: 'Default role for authenticated users',
    });

    // Check the IAM policy attached to the role
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'mobileanalytics:PutEvents',
              'cognito-sync:*',
              'cognito-identity:*',
            ],
            Resource:'*',
          },
          {
            Effect: 'Allow',
            Action: 'sts:AssumeRole',
            Resource: `arn:aws:iam::${cognitoStack.account}:role/*TenantRole*`,
          }
        ],
      },
      Roles: [
        authenticatedRoleCapture,
      ],
    });

    const capturedRoleRef = authenticatedRoleCapture.asObject().Ref; // Extract role's logical ID from captured value
    expect(capturedRoleRef).toMatch(/^NuoaAuthRole[A-Za-z0-9]+$/); // Determine that the captured logical ID ref matches expected pattern
  });
});
