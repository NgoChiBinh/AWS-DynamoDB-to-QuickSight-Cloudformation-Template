import { App } from 'aws-cdk-lib';
import { Capture, Match, Template } from 'aws-cdk-lib/assertions';
import { AthenaQuickSightStack } from "../../src/lib/athenaQS_stack";

describe('AthenaQSStack', () => {
    const app = new App();
    const athenaQSStack = new AthenaQuickSightStack(app, 'AthenaQSStack', {
        env: {
            account: '891377270638',
            region: 'ap-southeast-1',
        }
    });

    const template = Template.fromStack(athenaQSStack);

    test('Creates an S3 bucket for Athena results with auto-delete objects', () => {
        template.hasResource('AWS::S3::Bucket', {
            DeletionPolicy: 'Delete', 
            Properties: {
                Tags: [
                    {
                        Key: 'aws-cdk:auto-delete-objects',
                        Value: 'true'
                    }
                ]
            }
        });
    
        template.resourceCountIs('Custom::S3AutoDeleteObjects', 1); 
    });

    test('Creates an IAM Role for Athena', () => {
        template.hasResourceProperties('AWS::IAM::Role', {
            AssumeRolePolicyDocument: {
                Statement: [
                    {
                        Action: 'sts:AssumeRole',
                        Effect: 'Allow',
                        Principal: { Service: 'lambda.amazonaws.com'  
 }
                    }
                ]
            },
            ManagedPolicyArns: [
                {
                    'Fn::Sub': 'arn:${AWS::Partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
                },
            ]
        });
    });

    test('Create a Default IAM role policy for Athena Role', () => {
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: [
                    {
                        Action: "s3:GetBucketLocation",
                        Resource: `arn:aws:s3:::*`,
                        Effect: "Allow",
                        Sid: "GetBucketLocationPermission"
                    },
                    {
                        Action: [
                            "s3:GetObject",
                            "s3:ListBucket"
                        ],
                        Resource: [
                            Match.stringLikeRegexp("arn:aws:s3:::*"),
                            Match.stringLikeRegexp("arn:aws:s3:::*"),
                        ],
                        Effect: "Allow",
                        Sid: "DatalakeQueryPermissions"
                    },
                    {
                        Action: [
                            'athena:StartQueryExecution',
                            'athena:GetQueryExecution',
                            'athena:CreateTable',
                            'glue:GetDatabase',
                            'glue:CreateTable',
                            'glue:GetTable',
                            'glue:UpdateTable',
                            'quicksight:DescribeDataSet',
                            'quicksight:CreateIngestion'
                        ],
                        Resource: "*",
                        Effect: "Allow",
                        Sid: "AthenaQueryPermission"
                    },
                    {
                        Action: [
                            'athena:GetQueryResults',
                            's3:ListMultipartUploadParts',
                            'athena:GetWorkGroup',
                            's3:PutObject',
                            's3:GetObject',
                            'athena:StopQueryExecution',
                            's3:GetBucketLocation',
                        ],
                        Resource: {'Fn::Join':[
                            "",
                            [
                                { "Fn::GetAtt": [ Match.stringLikeRegexp(`AthenaResultsBucket*`), "Arn" ] },
                                "*"
                            ]
                        ]},
                        Effect: "Allow",
                        Sid: "ResultBucketQueryPermissions"
                    },
                    {
                        Action: "lambda:InvokeFunction",
                        Resource: `arn:aws:lambda:${athenaQSStack.region}:${athenaQSStack.account}:function:AthenaQSStack-UpdateQuickSightFunction*`,
                        Effect: "Allow",
                        Sid: "InvokeUpdateFunctionPermission"
                    }
                ]
            }
        });
    });

    test('Creates Update QuickSight Lambda function', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            Environment: {
                Variables: {
                    // DATASET_ID: Match.stringLikeRegexp('*'), // Assuming datasetId is in cdk.json
                    ACCOUNT_ID: athenaQSStack.account,
                    REGION: athenaQSStack.region
                }
            },
            Handler: 'updateQS.updateQS',
            Role: { 'Fn::GetAtt':[ Match.stringLikeRegexp('AthenaRole*'), 'Arn'] },
            Runtime: 'nodejs18.x',
            Timeout: 60 // 1 minute in seconds
        });
    });

    test('Create Update Athena Table Lambda function', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            Environment: {
                Variables: {
                    ACCOUNT_ID: athenaQSStack.account,
                    REGION: athenaQSStack.region,
                    UPDATE_FUNC_ARN: {
                        'Fn::GetAtt':[
                            Match.stringLikeRegexp('UpdateQuickSightFunction*'),
                            "Arn"
                        ]
                    }
                }
            },
            Handler: 'createAthenaTable.createAthenaTable',
            Role: {
                'Fn::GetAtt': [
                    Match.stringLikeRegexp('AthenaRole*'),
                    'Arn'
                ]
            },
            Runtime: 'nodejs18.x',
            Timeout: 60
        });
    });
});