import {
    aws_dynamodb as dynamodb,
    aws_lambda as lambda,
    aws_iam as iam,
    aws_s3 as s3,
    aws_athena as athena,
    aws_sam as sam
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput, Fn } from 'aws-cdk-lib';

export class RLSTableStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Create RLS DynamoDB Table
        const RLS_Table = new dynamodb.TableV2(this, 'Table', {
            partitionKey: { name: 'UserArn', type: dynamodb.AttributeType.STRING },
            contributorInsights: true,
            tableClass: dynamodb.TableClass.STANDARD,
            pointInTimeRecovery: true,
            billing: dynamodb.Billing.provisioned({
                readCapacity: dynamodb.Capacity.fixed(1),
                writeCapacity: dynamodb.Capacity.autoscaled({ maxCapacity: 2, seedCapacity: 10 }),
            }),
            tableName: 'RowLevelSecurity_Nuoa',
            removalPolicy: RemovalPolicy.DESTROY,
        });

        // Create Spillbucket
        const spillbucket = new s3.Bucket(this, 'SpillBucket', {
            bucketName: 'rls-spillbucket',
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
        })

        // Create Outputbucket
        const outputBucket = new s3.Bucket(this, 'OutputBucket', {
            bucketName: 'rls-outputbucket',
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
        })

        // Create DynamoDB Athena connector
        new sam.CfnApplication(this, "AthenaToDynamoConnector", {
            location: {
                applicationId: "arn:aws:serverlessrepo:us-east-1:292517598671:applications/AthenaDynamoDBConnector",
                semanticVersion: "2022.34.1"
            },
            parameters: {
                AthenaCatalogName: "rls_catalog",
                SpillBucket: spillbucket.bucketName
            }
        });

        // Create Data Catalog for RLS Table
        new athena.CfnDataCatalog(this, 'rlsDatacatalog', {
            name: 'ddbconnector',
            type: 'LAMBDA',
            parameters: {
                function: 'arn:aws:lambda:ap-southeast-1:203903977784:function:rls_catalog',
            },
        });

        const qsrole = iam.Role.fromRoleArn(
            this, 
            'QuickSightRoleImport', 
            `arn:aws:iam::${this.account}:role/service-role/aws-quicksight-service-role-v0`
        );
        // Add Permissions to access spillbucket and outputbucket to Quicksight
        qsrole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSQuicksightAthenaAccess'));
        qsrole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')); // Change to Invoke Lambda
        qsrole.addToPrincipalPolicy(new iam.PolicyStatement({
            actions: [
                's3:ListAllMyBuckets',
            ],
            resources: ['*'],
        }));
        qsrole.addToPrincipalPolicy(new iam.PolicyStatement({
            actions: [
            's3:ListBucket',
            's3:ListBucketMultipartUploads',
            's3:GetBucketLocation',
            ],
            resources: [
            spillbucket.bucketArn,
            outputBucket.bucketArn,
            ],
        }));
        qsrole.addToPrincipalPolicy(new iam.PolicyStatement({
            actions: [
            's3:GetObject',
            's3:GetObjectVersion',
            's3:PutObject',
            's3:AbortMultipartUpload',
            's3:ListMultipartUploadParts',
            ],
            resources: [
            spillbucket.bucketArn + '/*',
            outputBucket.bucketArn + '/*',
            ],
        }));
        qsrole.addToPrincipalPolicy(new iam.PolicyStatement({
            actions: [
                'lambda:InvokeFunction'
            ],
            resources: [
                'arn:aws:lambda:ap-southeast-1:203903977784:function:rls_catalog'
            ]
        }));

        // IAM Role for Athena
        const rlsRole = new iam.Role(this, 'RLSRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });

        // Get S3 bucket location permissions
        rlsRole.addToPolicy(new iam.PolicyStatement({
            sid: 'S3BucketPermissions',
            actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:BatchWriteItem',
            ],
            resources: [RLS_Table.tableArn],
        }));

        rlsRole.addToPolicy(new iam.PolicyStatement({
            sid: 'CreateIngestionPolicy',
            actions: [
                'quicksight:CreateIngestion'
            ],
            resources: [
                `arn:aws:quicksight:${this.region}:${this.account}:dataset/${this.node.tryGetContext('rlsDatasetId')}/ingestion/*`
            ],
        }))

        const rowLevelSecurityFunc = new lambda.Function(this, 'UpdateRowLevelSecurityFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'rowLevelSecurity.rowLevelSecurity',
            code: lambda.Code.fromAsset('src/lambda-code/rowLevelSecurity'),
            role: rlsRole,
            environment: {
                REGION: this.region,
                AWS_ACC_ID: this.account,
                RLS_DATASET_ID: this.node.tryGetContext('rlsDatasetId')
            },
            timeout: Duration.minutes(1),
        });

        // Outputs
        new CfnOutput(this, 'RLSTableFunc', {
            value: rowLevelSecurityFunc.functionName,
            description: 'The name function that update the Row Level Security Table',
            exportName: 'RLSTableFunc'
        });
        new CfnOutput(this, 'RLSTableFuncARN', {
            value: rowLevelSecurityFunc.functionArn,
            description: 'The ARN of the function that update the Row Level Security Table',
            exportName: 'RLSTableFuncARN'
        });
    }
}