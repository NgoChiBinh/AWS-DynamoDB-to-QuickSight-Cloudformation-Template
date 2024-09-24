import {
    CreateDataSourceCommand,
    CreateDataSetCommand,
    PutDataSetRefreshPropertiesCommand,
    DescribeDataSourceCommand,
    QuickSightClient,
    DescribeDataSetCommand,
}from '@aws-sdk/client-quicksight';
import {
    GetTableMetadataCommand,
    AthenaClient,
} from '@aws-sdk/client-athena';

import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';

// Mock the AWS SDK clients
const mockQuickSightClient = mockClient(QuickSightClient);
const mockAthenaClient = mockClient(AthenaClient);

// Mock your createQuickSightResource helper
const { createResource } = require('../../../src/lambda-code/dtbpipeline/createQuicksightDataset/helper/createResource'); 

// Import the function to be tested
const { createQuicksightDataset } = require('../../../src/lambda-code/dtbpipeline/createQuicksightDataset/createQuicksightDataset'); 

// ... other imports

describe('createQuicksightDataset', () => {
    beforeEach(() => {
        // Set environment variables (including the ones identified as missing)
        process.env.AWS_ACC_ID = '123456789012';
        process.env.REGION = 'your-aws-region'; 
        process.env.ADMIN_ID = 'your-admin-user-id';
        process.env.DATASOURCE_ID = 'your-datasource-id';
        process.env.DATASOURCE_NAME = 'your-datasource-name';
        process.env.DATASET_ID = 'your-dataset-id';
        process.env.DATASET_NAME = 'your-dataset-name';
        process.env.CATALOG_NAME = 'your-catalog-name';
        process.env.DATABASE_NAME = 'your-database-name';
        process.env.LATEST_PARTITION_TABLE_NAME = 'your-latest-partition-table-name';
        process.env.RLS_DATASET_ID = 'your-rls-dataset-id';
        // ... set other environment variables

        // Reset mocks
        mockQuickSightClient.reset();
        mockAthenaClient.reset();
    });

    afterEach(() => {
        // ... clear any mock environment variables if needed
    });

    it('should create a new data source successfully', async () => {
        mockAthenaClient
            .on(GetTableMetadataCommand)
            .resolves({
                TableMetadata: {
                    Name: 'test-table',
                    Columns: [
                        { Name: 'column1', Type: 'varchar' },
                        { Name: 'column2', Type: 'bigint' },
                    ]
                }
            });

        // Mock QuickSight CreateDataSource responses
        mockQuickSightClient
            .on(CreateDataSourceCommand)
            .resolves({ 
                Status: 200, 
                DataSourceId: 'mocked-datasource-id', 
            });

        mockQuickSightClient
            .on(DescribeDataSourceCommand)
            .resolves({ 
                DataSource: {
                    Status: 'CREATION_SUCCESSFUL' 
                }
            }); 

        // Mock Quicksight CreateDataSet responses
        mockQuickSightClient
            .on(CreateDataSetCommand)
            .resolves({
                Status: 200,
                DataSetId: 'mocked-rls-dataset-id'
            });

        mockQuickSightClient
            .on(DescribeDataSetCommand)
            .resolves({ 
                Status: 200
            }); 

        // Mock Quicksight CreateDataSet responses
        mockQuickSightClient
            .on(CreateDataSetCommand)
            .resolves({
                Status: 200,
                DataSetId: 'mocked-dataset-id'
            });

        mockQuickSightClient
            .on(DescribeDataSetCommand)
            .resolves({ 
                Status: 200
            }); 

        mockQuickSightClient
            .on(PutDataSetRefreshPropertiesCommand)
            .resolves({
                Status: 200
            });

        const event = {}; 
        await createQuicksightDataset(event);

        // Assertions
        expect(mockQuickSightClient.calls()).toHaveLength(7); 
        expect(mockAthenaClient.calls()).toHaveLength(1); 

        const createDataSourceCall = mockQuickSightClient.call(0);
        expect(createDataSourceCall.args[0]).toBeInstanceOf(CreateDataSourceCommand);

        const describeDataSourceCall1 = mockQuickSightClient.call(1);
        expect(describeDataSourceCall1.args[0]).toBeInstanceOf(DescribeDataSourceCommand);
        expect(describeDataSourceCall1.args[0].input).toMatchObject({
            AwsAccountId: process.env.AWS_ACC_ID,
            DataSourceId: process.env.DATASOURCE_ID, 
        });

        const createDatasetCall = mockQuickSightClient.call(2);
        expect(createDatasetCall.args[0]).toBeInstanceOf(CreateDataSetCommand);
        expect(createDatasetCall.args[0].input).toMatchObject({
            AwsAccountId: process.env.AWS_ACC_ID,
            DataSetId: process.env.DATASET_ID,
            Name: process.env.DATASET_NAME,
        });

        const describeDatasetCall1 = mockQuickSightClient.call(3);
        expect(describeDatasetCall1.args[0]).toBeInstanceOf(DescribeDataSetCommand);
        expect(describeDatasetCall1.args[0].input).toMatchObject({
            AwsAccountId: process.env.AWS_ACC_ID,
            DataSetId: process.env.DATASET_ID,
        });

        const createRLSDatasetCall = mockQuickSightClient.call(4);
        expect(createRLSDatasetCall.args[0]).toBeInstanceOf(CreateDataSetCommand);
        expect(createRLSDatasetCall.args[0].input).toMatchObject({
            AwsAccountId: process.env.AWS_ACC_ID,
            DataSetId: process.env.RLS_DATASET_ID,
            Name: 'Row Level Security Dataset',
        });

        const describeRLSDatasetCall = mockQuickSightClient.call(5);
        expect(describeRLSDatasetCall.args[0]).toBeInstanceOf(DescribeDataSetCommand);
        expect(describeRLSDatasetCall.args[0].input).toMatchObject({
            AwsAccountId: process.env.AWS_ACC_ID,
            DataSetId: process.env.RLS_DATASET_ID,
        });

        const putDataSetRefreshPropertiesCall = mockQuickSightClient.call(6);
        expect(putDataSetRefreshPropertiesCall.args[0]).toBeInstanceOf(PutDataSetRefreshPropertiesCommand);
        expect(putDataSetRefreshPropertiesCall.args[0].input).toMatchObject({
            AwsAccountId: process.env.AWS_ACC_ID,
            DataSetId: process.env.DATASET_ID,
            DataSetRefreshProperties: { 
                RefreshConfiguration: {
                    IncrementalRefresh: {
                        LookbackWindow: {
                            ColumnName: 'date',
                            Size: 1,
                            SizeUnit: "DAY",
                        },
                    },
                },
             }
        });

        const getTableMetadataCall = mockAthenaClient.call(0);
        expect(getTableMetadataCall.args[0]).toBeInstanceOf(GetTableMetadataCommand);
    });

    it('should handle Athena error gracefully', async () => {
        mockAthenaClient
            .on(GetTableMetadataCommand)
            .resolves({
                TableMetadata: {
                    Name: 'test-table',
                    Columns: [
                        { Name: 'column1', Type: 'varchar' },
                        { Name: 'column2', Type: 'bigint' },
                    ]
                }
            });
    
        mockAthenaClient
            .on(CreateDataSourceCommand)
            .rejects(new Error('Mocked Athena error'));
    
        const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation((...args) => {
            console.log('Mocked console.error:', ...args); // Log the mocked error for debugging
        });
    
        await createQuicksightDataset();

        expect(consoleErrorMock).toHaveBeenCalledWith('Error creating Quicksight Data Source/Dataset: ', expect.any(Error));
        consoleErrorMock.mockRestore();
    });
});