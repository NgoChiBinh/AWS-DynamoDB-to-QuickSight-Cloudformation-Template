import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { RLSTableStack } from '../../src/lib/rls_dynamodbTable_stack'; // Adjust the path as necessary

test('RLSTableStack creates resources with correct properties', () => {
const app = new App();

// Set context values for the stack
const mockDatasetId = 'my-dataset-id';
app.node.setContext('rlsDatasetId', mockDatasetId);

const stack = new RLSTableStack(app, 'TestRLSTableStack');
const template = Template.fromStack(stack);

// Assert DynamoDB Table properties
template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
    TableName: 'RowLevelSecurity_Nuoa',
    AttributeDefinitions: [{ AttributeName: 'UserArn', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'UserArn', KeyType: 'HASH' }],
    BillingMode: 'PROVISIONED',
    Replicas: [ 
      { Region: {Ref: 'AWS::Region'} } 
    ],
    WriteProvisionedThroughputSettings: {
      WriteCapacityAutoScalingSettings: {
        MaxCapacity: 2,
        SeedCapacity: 10
      }
    }
  });

// Assert S3 Buckets properties
template.hasResourceProperties('AWS::S3::Bucket', {
    BucketName: 'rls-spillbucket',
});
template.hasResourceProperties('AWS::S3::Bucket', {
    BucketName: 'rls-outputbucket',
});

// Assert SAM Application (Athena Connector)
template.hasResourceProperties('AWS::Serverless::Application', {
    Location: {
        ApplicationId: "arn:aws:serverlessrepo:us-east-1:292517598671:applications/AthenaDynamoDBConnector",
        SemanticVersion: "2022.34.1"
    },
    Parameters: {
        AthenaCatalogName: "rls_catalog",
        SpillBucket: {Ref: Match.stringLikeRegexp('SpillBucket*')} 
    }
});

// Assert Athena Data Catalog
template.hasResourceProperties('AWS::Athena::DataCatalog', {
    Name: 'ddbconnector',
    Type: 'LAMBDA',
    Parameters: {
    function: 'arn:aws:lambda:ap-southeast-1:203903977784:function:rls_catalog'
    }
});

// Assert Lambda Function properties (you might need to adjust based on your actual Lambda code)
template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'rowLevelSecurity.rowLevelSecurity',
    Runtime: 'nodejs18.x',
    Timeout: 60,
    Environment: {
        Variables: {
            REGION: { Ref: 'AWS::Region' },
            AWS_ACC_ID: { Ref: 'AWS::AccountId' },
            RLS_DATASET_ID: mockDatasetId
        }
    }
});

// Assert IAM Role and Policies (this is a basic check, you might want to add more specific assertions for the policy statements)
template.hasResourceProperties('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
    Statement: [{
        Action: 'sts:AssumeRole',
        Effect: 'Allow',
        Principal: { Service: 'lambda.amazonaws.com' }
    }],
    Version: '2012-10-17'
    }
});
});