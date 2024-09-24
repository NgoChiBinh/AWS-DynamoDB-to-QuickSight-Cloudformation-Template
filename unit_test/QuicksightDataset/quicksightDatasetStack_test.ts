import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { QuickSightDataStack } from '../../src/lib/quicksightData_stack'; // Adjust the path

    test('QuickSightDataStack creates resources with correct properties', () => {
    const app = new App();

    // Set context values (replace with appropriate mock values)
    app.node.setContext('catalogName', 'my-catalog');
    app.node.setContext('databaseName', 'my-database');
    app.node.setContext('latestPartitionTableName', 'my-table');
    app.node.setContext('adminId', 'admin-user-id');
    app.node.setContext('dataSourceId', 'data-source-id');
    app.node.setContext('dataSourceName', 'My Data Source');
    app.node.setContext('datasetId', 'dataset-id');
    app.node.setContext('datasetName', 'My Dataset');
    app.node.setContext('rlsDatasetId', 'rls-dataset-id');

    const stack = new QuickSightDataStack(app, 'TestQuickSightDataStack');
    const template = Template.fromStack(stack);

    // Assert Lambda Function properties
    template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: 'createQuicksightDataset.createQuicksightDataset',
        Runtime: 'nodejs18.x',
        Timeout: 60, // 1 minute
        Environment: {
        Variables: {
            REGION: { Ref: 'AWS::Region' },
            AWS_ACC_ID: { Ref: 'AWS::AccountId' },
            CATALOG_NAME: 'my-catalog',
            DATABASE_NAME: 'my-database',
            LATEST_PARTITION_TABLE_NAME: 'my-table',
            ADMIN_ID: 'admin-user-id',
            DATASOURCE_ID: 'data-source-id',
            DATASOURCE_NAME: 'My Data Source',
            DATASET_ID: 'dataset-id',
            DATASET_NAME: 'My Dataset',
            RLS_DATASET_ID: 'rls-dataset-id'
        }
        }
    });

    // Assert IAM Role and Policies
    template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
        Statement: [
            {
                Action: 'sts:AssumeRole',
                Effect: 'Allow',
                Principal: {
                    Service: 'lambda.amazonaws.com'
                }
            },
            {
                Action: 'sts:AssumeRole',
                Effect: 'Allow',
                Principal: {
                    Service: 'quicksight.amazonaws.com'
                }
            }
        ],
        Version: '2012-10-17'
        },
        ManagedPolicyArns: [
        { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']] }
        ]
    });


    // Assert inline policy for QuickSight permissions
    template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
        Statement: [
            {
            Action: [
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
            Effect: 'Allow',
            Resource: '*'
            }
        ],
        Version: '2012-10-17'
        },
        // Assert that this policy is attached to the Lambda role
        Roles: [
            { Ref: Match.stringLikeRegexp('NuoaLambdaExecutionRole*') } // Replace with the actual logical ID if it's different
        ]
    });

  // Assert CfnOutput
  template.hasOutput('QuicksightDatasetFunctionArn', {
    Value: {
      'Fn::GetAtt': [ Match.stringLikeRegexp('QuicksightDatasourceDatasetFunction*'), 'Arn' ]
    },
    Description: 'Arn of function that creates Quicksight Data Source/Dataset',
    Export: {
      Name: 'QuicksightDatasetFunctionArn'
    }
  });
});