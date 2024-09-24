const { 
    QuickSightClient, 
    CreateIngestionCommand 
} = require("@aws-sdk/client-quicksight");

// Region and AWS Account ID
const region = process.env.REGION;
const account = process.env.ACCOUNT_ID

// AWS-SDK Client
const quicksightClient = new QuickSightClient({ region: region });

exports.updateQS = async (event) => {
    const datasetId = process.env.DATASET_ID;
    const timestamp = Date.now();

    // Params for Dataset Refresh Command
    const refreshDatasetParams = { 
        DataSetId: datasetId, 
        IngestionId: `refresh-${timestamp}`,
        AwsAccountId: account,
        IngestionType: "INCREMENTAL_REFRESH",
    };
    const refreshCommand = new CreateIngestionCommand(refreshDatasetParams);
    
    try {
        const refreshResponse = await quicksightClient.send(refreshCommand);
        console.log('Refresh status ', refreshResponse.IngestionStatus);
        if(refreshResponse.IngestionStatus === "INITIALIZED") {
            console.log(`QuickSight dataset ${datasetId} update underway`);
            return {
                statusCode: 200,
                body: `QuickSight dataset ${datasetId} update underway`
            };
        }
        else {
            console.log(`QuickSight dataset ${datasetId} updated failed to start`);
            return {
                statusCode: 400,
                body: `QuickSight dataset ${datasetId} updated failed to start`,
            }
        }
    } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            
            return;
        }
        console.error(`Failed to refresh dataset ${datasetId} due to ${error}`);
        throw error;
    }
};