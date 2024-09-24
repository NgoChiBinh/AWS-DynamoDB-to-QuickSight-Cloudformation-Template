import {
    AthenaClient,
    StartQueryExecutionCommand,
    GetQueryExecutionCommand,
} from '@aws-sdk/client-athena';
import {
    LambdaClient,
    InvokeCommand,
} from '@aws-sdk/client-lambda';
import { mockClient } from 'aws-sdk-client-mock';

const { createAthenaTable } = require('../src/lambda-code/dtbpipeline/createAthenaTable/createAthenaTable');

const athenaMock = mockClient(AthenaClient);
const lambdaMock = mockClient(LambdaClient);

describe('createAthenaTable Lambda Function', () => {
    beforeEach(() => {
        athenaMock.reset();
    });

    // Mock environment variables (if needed)
    process.env.REGION = 'us-east-1'; 
    process.env.RESULT_BUCKET = 'your-result-bucket';
    process.env.UPDATE_FUNC_ARN = 'your-update-function-arn';
    process.env.DATABASE_NAME = 'your-database-name';
    process.env.TABLE_NAME = 'your-table-name';
    process.env.DATA_BUCKET = 'your-data-bucket';

    it('should create Athena table and invoke update function on success', async () => {
        // Mock successful Athena responses
        athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: 'test-query-id' });
        athenaMock.on(GetQueryExecutionCommand).resolvesOnce({ 
            QueryExecution: { Status: { State: 'RUNNING' } } 
        }).resolves({ 
            QueryExecution: { Status: { State: 'SUCCEEDED' } } 
        });
        // Mock successful Lambda invoke
        lambdaMock.on(InvokeCommand).resolves({ StatusCode: 200 });

        const result = await createAthenaTable({});
        console.log(result);

        // Check if specific commands were called
        expect(athenaMock.commandCalls(StartQueryExecutionCommand)).toHaveLength(1); 
        expect(athenaMock.commandCalls(GetQueryExecutionCommand)).toHaveLength(2); // Called twice in your code
        expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(1); 
    }, 10000);

    it('should handle Athena query failure', async () => {
        // Mock Athena to return a 'FAILED' status
        athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: 'test-query-id' });
        athenaMock.on(GetQueryExecutionCommand).resolves({
            QueryExecution: { Status: { State: 'FAILED' } }
        });
        // Invoke your Lambda function 
        const result = await createAthenaTable({});
        console.log(result);
        
        // Assertions
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain('Athena tables unsuccessfully created.');
    }, 10000);

    it('should handle Athena query cancellation', async () => {
        // Mock Athena to return a 'CANCELLED' status
        athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: 'test-query-id' });
        athenaMock.on(GetQueryExecutionCommand).resolves({
            QueryExecution: { Status: { State: 'CANCELLED' } }
        });
        // Invoke your Lambda function 
        const result = await createAthenaTable({});
        console.log(result);

        // Assertions
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain('Athena tables unsuccessfully created.');
    });
    
    it('should handle errors during Athena query execution', async () => {
        // Mock Athena to throw an error during query execution
        athenaMock.on(StartQueryExecutionCommand).rejects(new Error('Simulated Athena error'));
        // Invoke your Lambda function and expect it to throw an error
        await expect(createAthenaTable({})).rejects.toThrow('Simulated Athena error');
    });

    it('should handle errors while getting query status', async () => {
        // Mock Athena to throw an error when getting query status
        athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: 'test-query-id' });
        athenaMock.on(GetQueryExecutionCommand).rejects(new Error('Simulated query status error'));
        // Invoke your Lambda function and expect it to throw an error
        await expect(createAthenaTable({})).rejects.toThrow('Simulated query status error');
    });

    it('should handle Lambda invoke failure', async () => {
        // Mock successful Athena responses
        athenaMock.on(StartQueryExecutionCommand).resolves({ QueryExecutionId: 'test-query-id' });
        athenaMock.on(GetQueryExecutionCommand).resolvesOnce({
            QueryExecution: { Status: { State: 'RUNNING' } }
        }).resolves({
            QueryExecution: { Status: { State: 'FAILED' } }
        });

        // Mock Lambda invoke to fail
        lambdaMock.on(InvokeCommand).rejects(new Error('Simulated Lambda invoke error'));

        // Invoke your Lambda function and expect it to throw an error
        await expect(createAthenaTable({})).rejects.toThrow('Simulated Lambda invoke error');
    }, 10000);
});