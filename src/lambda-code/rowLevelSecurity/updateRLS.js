const { 
    QuickSightClient, 
    CreateIngestionCommand 
} = require("@aws-sdk/client-quicksight");

async function updateRLS() {

    // Region and AWS Account ID
    const region = process.env.REGION;
    const account = process.env.AWS_ACC_ID;
    // RLS Dataset ID
    const datasetId = process.env.RLS_DATASET_ID;

    // AWS-SDK Client
    const quicksightClient = new QuickSightClient({ region: region });  
    
    const timestamp = Date.now();

    // Params for Dataset Refresh Command
    const refreshRLSParams = { 
        DataSetId: datasetId, 
        IngestionId: `refresh-${timestamp}`,
        AwsAccountId: account,
        IngestionType: "FULL_REFRESH",
    };
    const refreshCommand = new CreateIngestionCommand(refreshRLSParams);

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
}

module.exports= { updateRLS };