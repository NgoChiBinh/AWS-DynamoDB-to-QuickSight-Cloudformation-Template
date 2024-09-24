import {
    aws_iam as iam,
    aws_cognito as cognito,
    aws_lambda as lambda,
    aws_events_targets as targets,
    aws_cloudtrail as cloudtrail,
} from 'aws-cdk-lib';
import { Construct } from "constructs";
import { Stack, StackProps, Duration, Fn } from "aws-cdk-lib";

export class QuickSightOnboardingStack extends Stack {

    constructor(scope: Construct, 
        id: string, 
        userPool: cognito.UserPool,
        userPoolClientId: string,
        nuoaAuthRoleArn: string,
        identityPoolId: string,
        props?: StackProps,
    ) {
        super(scope, id, props);
        // Import Dataset ARN
        const datasetArn = Fn.importValue('DatasetArn');

        // Import Update RLS function ARN
        const updateRLSTableArn = Fn.importValue('RLSTableFuncARN');

    // ========= Creating lambda function =========
        const lambdaRole = new iam.Role(this, "NuoaLambdaExecutionRole", {
            assumedBy: new iam.CompositePrincipal( // Use CompositePrincipal to combine principals
              new iam.ServicePrincipal("lambda.amazonaws.com"),
              new iam.ServicePrincipal("quicksight.amazonaws.com")
            ),
        });

        lambdaRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AWSLambdaBasicExecutionRole"
            )
        );

        // Policies for creating Dashboard, Tenant Group, Tenant Role, and Role Mapping
        lambdaRole.addToPolicy(
            new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'quicksight:CreateNamespace',
                'quicksight:CreateTemplate',
                'quicksight:CreateAnalysis',
                'quicksight:CreateDashboard',
                'quicksight:PassDataSet',
                'quicksight:UpdateAnalysisPermissions',
                'quicksight:UpdateDashboardPermissions',
                'quicksight:DescribeNamespace',
                'quicksight:DescribeTemplate',
                'quicksight:DescribeAnalysis',
                'quicksight:DescribeDashboard',
                'quicksight:RegisterUser',
            ],
            resources: ['*'],
            })
        );

        // Policy for creating Cognito Group
        lambdaRole.addToPolicy(
            new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'cognito-idp:CreateGroup',
            ],
            resources: ['*'],
            })
        );
      
        lambdaRole.addToPolicy(
            new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'iam:CreateRole',
                'iam:PutRolePolicy',
                'iam:GetRole',
                "iam:CreateServiceLinkedRole",
                "iam:PutRolePolicy",
                "iam:DeleteRole",
                "iam:AttachRolePolicy",
                "iam:DeleteRolePolicy",
                "iam:ListRolePolicies",
                "iam:ListAttachedRolePolicies",
                "iam:DetachRolePolicy",
            ],
            resources: ["*"],
            })
        );
      
        // Directory Services policies for creating Namespace
        lambdaRole.addToPolicy(
            new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "ds:CreateIdentityPoolDirectory",
                "ds:DescribeDirectories",
                "ds:AuthorizeApplication",
            ],
            resources: [`*`],
            })
        );

        lambdaRole.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["iam:PassRole"],
                resources: [
                    `arn:aws:iam::${this.account}:role/*TenantRole`,
                    `${nuoaAuthRoleArn}`,
                ],
            })
        );
    
        // Policies for creating and getting Identity Pool Role
        lambdaRole.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "cognito-identity:SetIdentityPoolRoles",
                    "cognito-identity:GetIdentityPoolRoles",
                ],
                resources: [
                    `arn:aws:cognito-identity:${this.region}:${this.account}:identitypool/*`,
                ],
            })
        );

        lambdaRole.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "lambda:InvokeFunction",
                ],
                resources: [
                    updateRLSTableArn,
                ],
            })
        );

        const qsOnboardingFunction = new lambda.Function(this, 'QuickSightOnboardingLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'quicksightOnboarding.quicksightOnboarding',
            code: lambda.Code.fromAsset('src/lambda-code/onboarding'),
            role: lambdaRole,
            environment: {
            REGION: this.region,
            AWS_ACC_ID: this.account,
            QUICKSIGHT_ADMIN_ID: this.node.tryGetContext('adminId'),
            USER_POOL_ID: userPool.userPoolId,
            IDPOOL_ID: identityPoolId,
            USER_POOL_CLIENT_ID: userPoolClientId,
            AUTH_ROLE_ARN: nuoaAuthRoleArn,
            DATASET: this.node.tryGetContext('datasetId'),
            UPDATE_RLS_ARN: updateRLSTableArn,
            },
            timeout: Duration.minutes(1),
        });

        const trail = new cloudtrail.Trail(this, "CloudTrail");

        const eventRule = cloudtrail.Trail.onEvent(this, "MyCloudWatchEvent", {
        target: new targets.LambdaFunction(qsOnboardingFunction),
        });
    
        eventRule.addEventPattern({
            account: [this.account],
            source: ["aws.cognito-idp"],
            detailType: ["AWS API Call via CloudTrail"],
            detail: {
                eventSource: ["cognito-idp.amazonaws.com"],
                eventName: ["CreateGroup"],
            },
        });
    } // 
}