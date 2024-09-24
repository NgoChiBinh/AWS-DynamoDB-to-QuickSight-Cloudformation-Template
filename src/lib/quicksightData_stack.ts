import {
    Duration,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_quicksight as quicksight
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput} from 'aws-cdk-lib';

export class QuickSightDataStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Creating lambda role
        const lambdaRole = new iam.Role(this, "NuoaLambdaExecutionRole", {
            assumedBy: new iam.CompositePrincipal( // Use CompositePrincipal to combine principal
              new iam.ServicePrincipal("lambda.amazonaws.com"),
              new iam.ServicePrincipal("quicksight.amazonaws.com")
            ),
        });

        // Add AWS managed Lambda Execution Policy
        lambdaRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AWSLambdaBasicExecutionRole"
            )
        );

        // Policies for creating Datasource and Dataset
        lambdaRole.addToPolicy(
            new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'quicksight:CreateDataSource',
                'quicksight:CreateDataset',
                'quicksight:DescribeDataSource',
                'quicksight:DescribeDataSet',
                'quicksight:PassDataSource',
                'quicksight:PassDataSet',
                'quicksight:PutDataSetRefreshProperties',
                'athena:GetTableMetadata',
                'glue:GetTable'
            ],
            resources: ['*'], // Specify relevant tables here
            })
        );

        const quicksight_dataSource_dataset_function = new lambda.Function(this, 'Quicksight_Datasource_Dataset_Function', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'createQuicksightDataset.createQuicksightDataset',
            code: lambda.Code.fromAsset('src/lambda-code/dtbpipeline/createQuicksightDataset'),
            role: lambdaRole,
            environment: {
                REGION: this.region,
                AWS_ACC_ID: this.account,
                CATALOG_NAME: this.node.tryGetContext('catalogName'),
                DATABASE_NAME: this.node.tryGetContext('databaseName'),
                LATEST_PARTITION_TABLE_NAME: this.node.tryGetContext('latestPartitionTableName'),
                ADMIN_ID: this.node.tryGetContext('adminId'),
                DATASOURCE_ID: this.node.tryGetContext('dataSourceId'),
                DATASOURCE_NAME: this.node.tryGetContext('dataSourceName'),
                DATASET_ID: this.node.tryGetContext('datasetId'),
                DATASET_NAME: this.node.tryGetContext('datasetName'),
                RLS_DATASET_ID: this.node.tryGetContext('rlsDatasetId'),
            },
            timeout: Duration.minutes(1),
        });
        const createQuicksightDatasetFuncArn = quicksight_dataSource_dataset_function.functionArn;

        // Arn of quicksight_dataSource_dataset_function
        new CfnOutput(this, 'QuicksightDatasetFunctionArn', {
            value: createQuicksightDatasetFuncArn,
            description: 'Arn of function that creates Quicksight Data Source/Dataset',
            exportName: 'QuicksightDatasetFunctionArn',
        });
    }
};