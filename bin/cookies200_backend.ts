#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AuthStack } from "../src/lib/auth_stack";
import { LogoutStack } from "../src/lib/logout_stack";
import { GenerateQSUrlStack } from "../src/lib/generateQSUrl_stack";
import { CognitoStack } from "../src/lib/cognito_stack";
import { QuickSightOnboardingStack } from "../src/lib/onboarding_stack";
import { AthenaQuickSightStack } from "../src/lib/athenaQS_stack";
import { QuickSightDataStack } from "../src/lib/quicksightData_stack";
import { JoinedTableWorkFlowStack } from "../src/lib/joinedTableWorkflow_stack";
import { RLSTableStack } from "../src/lib/rls_dynamodbTable_stack";
import { RLSGlueStack } from "../src/lib/rls_glue_stack";
import { GlueStack } from "../src/lib/glue_stack";
import { Glue } from "@aws-sdk/client-glue";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
}

const cognitoStack = new CognitoStack(app, "CognitoStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

const onboardingStack = new QuickSightOnboardingStack(
  app,
  "OnboardingStack",
  cognitoStack.userPool,
  cognitoStack.userPoolClientId,
  cognitoStack.nuoaAuthRoleARN,
  cognitoStack.identityPoolId,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);

const authStack = new AuthStack(
  app,
  "AuthStack",
  cognitoStack.userPool,
  cognitoStack.userPoolClientId,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);

const logoutStack = new LogoutStack(
  app,
  "LogoutStack",
  cognitoStack.userPool,
  cognitoStack.userPoolClientId,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);

const generateQSUrlStack = new GenerateQSUrlStack(
  app,
  "GenerateQSUrlStack",
  cognitoStack.userPool,
  cognitoStack.userPoolClientId,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);

const glueStack = new GlueStack(
  app,
  'GlueStack',
  {
    env: env,
  }
);

const joinedTableWorkflowStack = new JoinedTableWorkFlowStack(
  app,
  'JoinedTableWorkFlowStack',
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);

const quicksightDataStack = new QuickSightDataStack(
  app,
  'QuickSightDataStack',
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);

const athenaQSStack = new AthenaQuickSightStack(
  app, 
  'AthenaQuickSightStack',
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);

const rls_dynamodbTable_stack = new RLSTableStack(
  app,
  'RLSTableStack',
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);

const rls_glue_stack = new RLSGlueStack(
  app,
  'RLSGlueStack',
  {
    env: env,
  }
);

// Add depencies between stacks
rls_glue_stack.addDependency(rls_dynamodbTable_stack);
joinedTableWorkflowStack.addDependency(glueStack);
athenaQSStack.addDependency(joinedTableWorkflowStack);
athenaQSStack.addDependency(quicksightDataStack);
onboardingStack.addDependency(quicksightDataStack);
quicksightDataStack.addDependency(rls_glue_stack);

app.synth();
