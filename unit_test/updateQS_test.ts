import {
    QuickSightClient,
    CreateIngestionCommand,
} from '@aws-sdk/client-quicksight';
import { mockClient } from 'aws-sdk-client-mock';

const { updateQS } = require('../src/lambda-code/dtbpipeline/updateQuickSightDataset/updateQS');

const quicksightMock = mockClient(QuickSightClient);

describe('updateQS Lambda Function', () => {
    beforeEach(() => {
        // Reset mock before each test
        quicksightMock.reset();
        // Mock environment variables (if needed)
        process.env.REGION = 'us-east-1';
        process.env.ACCOUNT_ID = 'your-account-id';
        process.env.DATASET_ID = 'your-dataset-id';
    });

    it('should initiate QuickSight dataset update successfully', async () => {
        // Mock successful QuickSight response
        quicksightMock.on(CreateIngestionCommand).resolves({ IngestionStatus: 'INITIALIZED' });
        // Invoke your Lambda function 
        const result = await updateQS({}); 
        // Assertions
        expect(result?.statusCode).toBe(200);
        expect(result?.body).toContain(`QuickSight dataset ${process.env.DATASET_ID} update underway`);
        expect(quicksightMock.commandCalls(CreateIngestionCommand)).toHaveLength(1); 
    });

    it('should handle QuickSight update failure', async () => {
        // Mock QuickSight to return a non-'INITIALIZED' status
        quicksightMock.on(CreateIngestionCommand).resolves({ IngestionStatus: 'FAILED' });
        // Invoke your Lambda function 
        const result = await updateQS({}); 
        // Assertions
        expect(result?.statusCode).toBe(400);
        expect(result?.body).toContain(`QuickSight dataset ${process.env.DATASET_ID} updated failed to start`);
    });

    it('should handle errors during QuickSight update', async () => {
        // Mock QuickSight to throw an error
        quicksightMock.on(CreateIngestionCommand).rejects(new Error('Simulated QuickSight error'));
        // Invoke your Lambda function and expect it to log the error (no return value in your current code)
        await expect(updateQS({})).rejects.toThrow('Simulated QuickSight error') ;
    });
});