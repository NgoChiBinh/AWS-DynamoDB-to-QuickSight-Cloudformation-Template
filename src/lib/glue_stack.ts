import{
    aws_iam as iam,
    aws_glue as glue,
    aws_events as events,
    aws_events_targets as targets,
    aws_dynamodb as dynamodb,
    aws_s3 as s3,
    aws_s3_deployment as s3deploy,
    RemovalPolicy
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput} from 'aws-cdk-lib';

export class GlueStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Get name of datasource Bucket and Table from cdk.json
        const dataSourceBucket = this.node.tryGetContext('dataSourceBucket'); 
        const dataSourceTable = this.node.tryGetContext('tableName');

        // Get Glue Database name from cdk.json
        const databaseName = this.node.tryGetContext('databaseName');

        // Import existing DynamoDB tables
        const ActivityTable_Nuoa = dynamodb.Table.fromTableArn(
            this, 'ActivityTable', 
            `arn:aws:dynamodb:${this.region}:${this.account}:table/${this.node.tryGetContext('activityTableName')}`
        );
        const EntityTable_Nuoa = dynamodb.Table.fromTableArn(
            this, 'EntityTable', 
            `arn:aws:dynamodb:${this.region}:${this.account}:table/${this.node.tryGetContext('entityTableName')}`
        );
        const RLS_Table_Nuoa = dynamodb.Table.fromTableArn(
            this, 'RLSTable', 
            `arn:aws:dynamodb:${this.region}:${this.account}:table/${this.node.tryGetContext('rlsTableName')}`
        );

         // Create the S3 Glue Output Bucket 
        const glueOutputBucket = new s3.Bucket(this, 'GlueOutputBucket',{
            bucketName: dataSourceBucket,
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
        }); 

        // Deploy the Glue Job script to the newly created bucket
        new s3deploy.BucketDeployment(this, 'DeployGlueJobScript', {
            sources: [s3deploy.Source.asset('src/lambda-code/dtbpipeline/glueJobScript/')], 
            destinationBucket: glueOutputBucket, 
            destinationKeyPrefix: 'glue-scripts/' 
        });

        // Add permission to access output bucket to Quicksight
        const qsrole = iam.Role.fromRoleArn(
            this, 
            'QuickSightRoleImport', 
            `arn:aws:iam::${this.account}:role/service-role/aws-quicksight-service-role-v0`
        );
        qsrole.addToPrincipalPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:ListBucket',
                "s3:GetObject",
                "s3:GetObjectVersion",
                "s3:ListBucketMultipartUploads",
                "s3:GetBucketLocation",
                "s3:PutObject",
                "s3:AbortMultipartUpload",
                "s3:ListMultipartUploadParts"
            ],
            resources: [
                glueOutputBucket.bucketArn,
                `${glueOutputBucket.bucketArn}*`
            ],
        }));

        // Glue IAM Role
        const glueRole = new iam.Role(this, 'GlueRole', {
            assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
            managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
            ],
        });
        // Add DynamoDB read access to Glue Role
        const glue_joinJobPolicy = new iam.Policy(this, 'Glue_joinJobPolicy', {
            policyName: 'DynamoDBReadPolicy',
            roles: [glueRole],
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'dynamodb:DescribeTable',
                        'dynamodb:Scan',
                        'dynamodb:Query',
                    ],
                    resources: [
                        ActivityTable_Nuoa.tableArn,
                        EntityTable_Nuoa.tableArn,
                    ],
                }),
            ],
        });
        // Add full S3 access to the Glue role
        glueRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:GetObject',
                's3:PutObject',
                's3:ListBucket',
            ],
            resources: [
                `${glueOutputBucket.bucketArn}/*`, 
                glueOutputBucket.bucketArn,
            ],
        }));
        // IAM Policy for S3 Parquet Crawler
        const parquetTableCrawlPolicy = new iam.Policy(this, 'ParquetTableCrawlRolePolicy', {
            policyName: 'parquetTableCrawlRolePolicy',
            roles: [glueRole],
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                    "s3:GetObject",
                    "s3:PutObject"
                    ],
                    resources: [
                        `arn:aws:s3:::${dataSourceBucket}/${dataSourceTable}/*`
                    ],
                }),
            ],
        });

        // Glue Job
        const glue_joinJob = new glue.CfnJob(this, 'Glue_joinJob', {
            name: 'glue_join_job',
            role: glueRole.roleArn,
            command: {
                name: 'glueetl',
                pythonVersion: "3",
                scriptLocation: `s3://${glueOutputBucket.bucketName}/glue-scripts/glue__job.py`,
            },
            defaultArguments: {
                '--TempDir': glueOutputBucket.s3UrlForObject('temp/'),
                '--output_path': glueOutputBucket.s3UrlForObject(`${dataSourceTable}/`),
                '--activity_table': ActivityTable_Nuoa.tableName, 
                '--entity_table': EntityTable_Nuoa.tableName,     
            },
            maxRetries: 1,
            glueVersion: '4.0'
        });
        glue_joinJob.node.addDependency(glue_joinJobPolicy);

        // Create a single Glue Crawler to crawl Activity and Entity Table as well as RLS Table
        const dynamoDBCrawler = new glue.CfnCrawler(this, 'DynamoDBCrawler', {
            name:'dynamodb_db_crawler',
            role: glueRole.roleArn,
            databaseName: 'dynamodb_db',
            targets: {
                dynamoDbTargets: [
                    { path: ActivityTable_Nuoa.tableName },
                    { path: EntityTable_Nuoa.tableName },
                ],
            },
            recrawlPolicy: {
                recrawlBehavior: 'CRAWL_EVERYTHING'
            },
        });
        dynamoDBCrawler.node.addDependency(glue_joinJobPolicy);

        // Create crawler for joined table
        const parquetTableCrawler = new glue.CfnCrawler(this, 'S3ParquetTableCrawler', {
            name: "joinedTable-s3-parquet-crawler",
            role: glueRole.roleArn,
            databaseName: databaseName,
            targets: {
                s3Targets: [
                    { path: `s3://${dataSourceBucket}/${dataSourceTable}/` },
                ],
            },
        });

        // Output name of output Bucket
        new CfnOutput(this, 'OutputBucket', {
            value: glueOutputBucket.bucketName? glueOutputBucket.bucketName : '',
            description: 'Name of S3 Output Bucket',
            exportName: 'OutputBucket',
        });

        // Output name of join table glue workflow
        new CfnOutput(this, 'DynamoDBCrawlerName', {
            value: dynamoDBCrawler.name? dynamoDBCrawler.name : '',
            description: 'Name of glue DynamoDB Crawler',
            exportName: 'DynamoDBCrawlerName',
        });

        // Output name of join table glue workflow
        new CfnOutput(this, 'GlueJoinJobName', {
            value: glue_joinJob.name? glue_joinJob.name : '',
            description: 'Name of glue join job',
            exportName: 'GlueJoinJobName',
        });

        // Output name of join table glue workflow
        new CfnOutput(this, 'ParquetCrawlerName', {
            value: parquetTableCrawler.name? parquetTableCrawler.name : '',
            description: 'Name of glue crawler that crawls output bucket',
            exportName: 'ParquetCrawlerName',
        });
    }
};