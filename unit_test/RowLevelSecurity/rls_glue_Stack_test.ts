import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { RLSGlueStack } from '../../src/lib/rls_glue_stack';

test('RLSGlueStack creates Glue database and table with correct names and properties', () => {
    const app = new App();

    // Set the context value for rlsTableName
    const mockTableName = 'MyRLSTable';
    app.node.setContext('rlsTableName', mockTableName);

    const stack = new RLSGlueStack(app, 'TestRLSGlueStack'); 

    const template = Template.fromStack(stack);

    // Assert Glue Database properties
    template.hasResourceProperties('AWS::Glue::Database', {
    CatalogId: {
        Ref: 'AWS::AccountId'
    },
    DatabaseInput: {
        LocationUri: 'dynamo-db-flag',
        Name: mockTableName.toLowerCase() // Ensure lowercase conversion
    }
    });

    // Assert Glue Table properties
    template.hasResourceProperties('AWS::Glue::Table', {
    CatalogId: {
        Ref: 'AWS::AccountId'
    },
    DatabaseName: {
        Ref: 'rlsgluedatabase' // Reference to the database
    },
    TableInput: {
        Name: mockTableName.toLowerCase(),
        Parameters: {
        'classification': 'dynamodb',
        'sourceTable': mockTableName,
        'columnMapping': 'userarn=UserArn'
        },
        StorageDescriptor: {
        Columns: [
            {
            Name: 'userarn',
            Type: 'STRING'
            },
            {
            Name: 'tenantid',
            Type: 'STRING'
            }
        ]
        }
    }
    });

    // Assert dependency between table and database
    template.hasResource('AWS::Glue::Table', {
    DependsOn: ['rlsgluedatabase']
    });
});