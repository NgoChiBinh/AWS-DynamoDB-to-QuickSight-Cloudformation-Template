import  {
    GetCommand,
    PutCommand,
    BatchWriteCommand,
    DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';

const { updateRLS } = require('../../../src/lambda-code/rowLevelSecurity/updateRLS'); // Assuming you have this module

const dynamodbDocMock =  mockClient (DynamoDBDocumentClient);

// Mock the updateRLS function (if needed)
jest.mock('../../../src/lambda-code/rowLevelSecurity/updateRLS', () => ({
    updateRLS: jest.fn(),
}));

// Import the Lambda function after setting up the mocks
const { rowLevelSecurity } = require('../../../src/lambda-code/rowLevelSecurity/rowLevelSecurity'); // Replace with your actual file name

describe('rowLevelSecurity Lambda function', () => {
    beforeEach(() => {
        dynamodbDocMock.reset(); // Reset modules to ensure a clean state for each test
        process.env.REGION = 'ap-southeast-1'; // Set the region environment variable
    });

    it('should update RLS table with Admin permissions if admin user does not exist', async () => {
        // Resolves GetCommand with Item: undefined
        dynamodbDocMock.on(GetCommand).resolves({ Item: undefined });

        // Call the Lambda function
        const event = { tenant: 'testTenant', tenantid: '12345' };
        await rowLevelSecurity(event);

        // Assertions
        expect(dynamodbDocMock).toHaveReceivedCommandWith(GetCommand, { // Check GetCommand with specific input
            TableName: 'RowLevelSecurity_Nuoa',
            Key: {
                UserArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:user/default/admin_ncbinh'
            }
        });
        expect(dynamodbDocMock).toHaveReceivedCommandWith(BatchWriteCommand, {  RequestItems: {
            'RowLevelSecurity_Nuoa': [
              {
                PutRequest: {
                  Item: {
                    UserArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:user/default/admin_ncbinh',
                    tenantid: ''
                  }
                }
              },
              {
                PutRequest: {
                  Item: {
                    UserArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:user/default/Nham-Cookies200',
                    tenantid: ''
                  }
                }
              },
              {
                PutRequest: {
                  Item: {
                    UserArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:user/default/Nuoa-view',
                    tenantid: ''
                  }
                }
              }
            ]
          }
        });
        expect(updateRLS).toHaveBeenCalled(); 
    });

    it('should update RLS table with Tenant permissions if admin user exists', async () => {
        dynamodbDocMock.on(GetCommand).resolves({ 
            Item: { 
                UserArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:user/default/admin_ncbinh', 
                tenantid: '', 
            } 
        });

        // Call the Lambda function
        const event = { tenant: 'testTenant', tenantid: '12345' };
        await rowLevelSecurity(event);

        // Assertions
        expect(dynamodbDocMock).toHaveReceivedCommandWith(GetCommand, { // Check GetCommand with specific input
            TableName: 'RowLevelSecurity_Nuoa',
            Key: {
                UserArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:user/default/admin_ncbinh'
            }
        });
        expect(dynamodbDocMock).toHaveReceivedCommandWith(PutCommand, {
            TableName: 'RowLevelSecurity_Nuoa',
            Item: {
                UserArn: `arn:aws:quicksight:ap-southeast-1:203903977784:user/${event.tenant}/${event.tenant}TenantRole/${event.tenant}`,
                tenantid: event.tenantid
            },
        });
        expect(updateRLS).toHaveBeenCalled(); 
    });
});