import {
  aws_iam as iam,
  aws_cognito as cognito,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";

export class CognitoStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClientId: string;
  public readonly nuoaAuthRoleARN: string;
  public readonly identityPoolId: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

  // ========= Create User Pool =========
    const userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: false,
      userPoolName: "TenantUserPool",
      autoVerify: { email: true },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireUppercase: true,
        requireLowercase: true,
        requireSymbols: true,
      },
      signInAliases: {
        username: true,
        email: true,
      },
    });

    // Cognito Domain (Hosted UI)
    userPool.addDomain('EmbedDashboardDomain', {
      cognitoDomain: {
        domainPrefix: this.account
      }
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: "NuoaQuicksight",
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      oAuth: {
        scopes: [
          cognito.OAuthScope.OPENID, 
          cognito.OAuthScope.PROFILE
        ],
        flows: {
          implicitCodeGrant: true
        },
        callbackUrls: ['https://dummy'], // Placeholder URL
        logoutUrls: ['https://dummy']
      },
      generateSecret: false,
      authFlows: {
        userPassword: true,
        adminUserPassword: true,
        userSrp: true,
      },
    });

  // ========= Creating Create the OIDC Identity Provider =========
    // Construct the Provider URL
    const providerUrl = `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`;
    
    const oidcProvider = new iam.OpenIdConnectProvider(this, 'CognitoOIDCProvider', {
      url: providerUrl,
      clientIds: [userPoolClient.userPoolClientId],
    });

  // ========= Creating Cognito Identity Pool =========
    const identityPool = new cognito.CfnIdentityPool(this, 'TenantIdentityPool',
      {
        identityPoolName: "TenantIdentityPool",
        allowUnauthenticatedIdentities: false,
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: userPool.userPoolProviderName,
            serverSideTokenCheck: true,
          },
        ],
      }
    );

    // Output the Identity Pool ID
    new CfnOutput(this, "IdentityPoolId", {
      value: identityPool.ref,
      description: "The ID of the Cognito Identity Pool",
    });

    // Create Roles for authenticated users
    const nuoaAuthRole = new iam.Role(this, "NuoaAuthRole", {
      assumedBy: new iam.WebIdentityPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        }
      ),
      description: "Default role for authenticated users",
    });

    // Add policies for cognito operations
    nuoaAuthRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "mobileanalytics:PutEvents",
          "cognito-sync:*",
          "cognito-identity:*",
        ],
        resources: ["*"],
      })
    );
    
    // Add policies for assume tenant role
    nuoaAuthRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/*TenantRole*`],
      })
    );

    this.userPool = userPool;
    this.userPoolClientId = userPoolClient.userPoolClientId;
    this.nuoaAuthRoleARN = nuoaAuthRole.roleArn;
    this.identityPoolId = identityPool.ref;
  }
}
