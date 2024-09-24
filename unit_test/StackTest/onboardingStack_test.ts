import { App, Stack } from "aws-cdk-lib";
import { QuickSightOnboardingStack } from "../../src/lib/onboarding_stack";
import { Template } from "aws-cdk-lib/assertions";
import { CognitoStack } from "../../src/lib/cognito_stack";

jest.mock("../../src/lib/cognito_stack", () => {
  const mockUserPool = { userPoolId: "mockedUserPoolId" };

  return {
    CognitoStack: jest.fn().mockImplementation(() => ({
      userPool: mockUserPool, // Pass the object directly
      userPoolClientId: "mockedUserPoolClientId",
      nuoaAuthRoleARN: "mockedNuoaAuthRoleArn",
      identityPoolId: "mockedIdentityPoolId",
    })),
  };
});

describe("OnboardingStack", () => {
  let app: App;
  let onboardingStack: QuickSightOnboardingStack;

  beforeAll(() => {
    app = new App();
    const cognitoStack = new CognitoStack(app, "TestCognitoStack", {
      env: {
        account: "891377270638",
        region: "ap-southeast-1",
      },
    });

    onboardingStack = new QuickSightOnboardingStack(
      app,
      "TestOnboardingStack",
      cognitoStack.userPool,
      cognitoStack.userPoolClientId,
      cognitoStack.nuoaAuthRoleARN,
      cognitoStack.identityPoolId,
      {
        env: {
          account: "891377270638",
          region: "ap-southeast-1",
        },
      }
    );
  });

  test("creates a Lambda function", () => {
    const template = Template.fromStack(onboardingStack);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "quicksightOnboarding.quicksightOnboarding",
      Runtime: "nodejs18.x",
      Environment: {
        Variables: {
          REGION: "ap-southeast-1",
          AWS_ACC_ID: "891377270638",
          QUICKSIGHT_ADMIN_ID: "Cookies200",
          USER_POOL_ID: "mockedUserPoolId",
          IDPOOL_ID: "mockedIdentityPoolId",
          USER_POOL_CLIENT_ID: "mockedUserPoolClientId",
          AUTH_ROLE_ARN: "mockedNuoaAuthRoleArn",
          DATASET: "bc93b225-e6f7-4664-8331-99e66f5b7841",
        },
      },
      Timeout: 60, // Check timeout value
    });
  });

  test("Lambda role has necessary permissions", () => {
    // Use `template.findResources()` to find the IAM policy
    const template = Template.fromStack(onboardingStack);

    // Use `template.findResources()` to find the IAM policy
    const policyResources = template.findResources("AWS::IAM::Policy", {
      Properties: {
        PolicyName: "NuoaLambdaExecutionRoleDefaultPolicy2C513FA5", // Wildcard pattern
      },
    });

    expect(Object.keys(policyResources)).toHaveLength(1); // Ensure only one policy matches
    const policyResource = policyResources[Object.keys(policyResources)[0]]; // Get the first (and only) matching policy

    // Get the policy statements
    const receivedStatements =
      policyResource.Properties.PolicyDocument.Statement;

    // Assert the entire policy statements array (with the exact expected structure)
    expect(receivedStatements).toEqual(
      expect.arrayContaining([
        {
          Action: [
            "quicksight:CreateNamespace",
            "quicksight:CreateTemplate",
            "quicksight:CreateAnalysis",
            "quicksight:CreateDashboard",
            "quicksight:PassDataSet",
            "quicksight:UpdateAnalysisPermissions",
            "quicksight:UpdateDashboardPermissions",
            "quicksight:DescribeNamespace",
            "quicksight:DescribeTemplate",
            "quicksight:DescribeAnalysis",
            "quicksight:DescribeDashboard",
            "quicksight:RegisterUser",
          ],
          Effect: "Allow",
          Resource: "*",
        },
        {
          Action: "cognito-idp:CreateGroup",
          Effect: "Allow",
          Resource: "*",
        },
        {
          Action: [
            "iam:CreateRole",
            "iam:PutRolePolicy",
            "iam:GetRole",
            "iam:CreateServiceLinkedRole",
            "iam:DeleteRole",
            "iam:AttachRolePolicy",
            "iam:DeleteRolePolicy",
            "iam:ListRolePolicies",
            "iam:ListAttachedRolePolicies",
            "iam:DetachRolePolicy",
          ],
          Effect: "Allow",
          Resource: "*",
        },
        {
          Action: [
            "ds:CreateIdentityPoolDirectory",
            "ds:DescribeDirectories",
            "ds:AuthorizeApplication",
          ],
          Effect: "Allow",
          Resource: "*",
        },
        {
          Action: "iam:PassRole",
          Effect: "Allow",
          Resource: [
            "arn:aws:iam::891377270638:role/*TenantRole",
            "mockedNuoaAuthRoleArn", // Replace with the actual ARN if needed
          ],
        },
        {
          Action: [
            "cognito-identity:SetIdentityPoolRoles",
            "cognito-identity:GetIdentityPoolRoles",
          ],
          Effect: "Allow",
          Resource:
            "arn:aws:cognito-identity:ap-southeast-1:891377270638:identitypool/*",
        },
      ])
    );
  });
});
