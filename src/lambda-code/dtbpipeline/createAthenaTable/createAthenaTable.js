const { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand } = require("@aws-sdk/client-athena");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { DescribeDataSetCommand, QuickSightClient } = require("@aws-sdk/client-quicksight")

const region = process.env.REGION;
const account = process.env.ACCOUNT_ID;
const resultBucket = process.env.RESULT_BUCKET;
const updateFunctionArn = process.env.UPDATE_FUNC_ARN;
const quicksightDataSetFuncArn = process.env.QUICKSIGHT_DATASOURCE_FUNC_ARN
const datasetId = process.env.DATASET_ID;

const athenaClient = new AthenaClient({ region: region });
const lambdaClient = new LambdaClient({ region: region });
const quickSightClient = new QuickSightClient ({ region: region });

exports.createAthenaTable = async (event) => {

    const catalogName = process.env.CATALOG_NAME;
    const databaseName = process.env.DATABASE_NAME;
    const tableName = process.env.TABLE_NAME;

    const query = 
        `
        CREATE OR REPLACE VIEW latest_partition_data AS
        SELECT * 
        FROM data
        WHERE partition_0 = (SELECT partition_0 FROM "${catalogName}"."${databaseName}"."${tableName}" ORDER BY partition_0 DESC LIMIT 1);
        `
    ;

    const queryExecutionCommand = new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: { Database: databaseName },
        ResultConfiguration: { OutputLocation: `s3://${resultBucket}/athena-results/` },
    });

    try {
        const athenaClientRes = await athenaClient.send(queryExecutionCommand);
        const queryId = athenaClientRes.QueryExecutionId;
        const result = await waitForQuery(queryId);
        return result;
    } catch (err) {
        console.error(`Error executing query: ${query}`, err);
        throw err;
    }
};

// Wait for query to complete
async function waitForQuery(queryId) {
    const getQueryCommand = new GetQueryExecutionCommand({
        QueryExecutionId: queryId,
    });
    const MAX_RETRIES = 100;
    const RETRY_DELAY_MS = 5000;
    for (let retryCount = 0; retryCount < MAX_RETRIES; retryCount++) {
        try {
            const queryStatusRes = await athenaClient.send(getQueryCommand);
            const queryStatus = queryStatusRes.QueryExecution.Status.State;
            console.log(`Query status: ${queryStatus}`);
            if (queryStatus === 'SUCCEEDED') { // Query succeeded
                let datasetExists = await checkDataset(); // Check if Dataset exist
                if (datasetExists === true) {
                    console.log("Dataset exist, invoking update");
                    await invokeUpdate(updateFunctionArn); // Dataset exists, invoke create dataset function
                } else if (datasetExists === false) {
                    console.log("Dataset doesn't exist yet, creating dataset");
                    await invokeUpdate(quicksightDataSetFuncArn); // Dataset doesn't exists, invoke create dataset function
                }
                return {
                    statusCode: 200,
                    body: 'Athena tables created successfully, QuickSight datasets update initiated.',
                };
            } else if (queryStatus === 'FAILED' || queryStatus === 'CANCELLED') {
                return { // Query failed/cancelled
                    statusCode: 400,
                    body: "Athena tables unsuccessfully created.",
                };
            }
            // If query is still running, wait and retry
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        } catch (error) {
            console.error('Error getting query execution status: ', error);
            throw error;
        }
    }
    throw new Error('Query exceeded maximum retries');
};

async function invokeUpdate(functionArn) {
    const invokeUpdate = new InvokeCommand({
        FunctionName: functionArn,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
    });
    try {
        const lambdaClientRes = await lambdaClient.send(invokeUpdate);
        // Handle response
        if (lambdaClientRes.StatusCode === 200) {
            console.log('Lambda Function successfully invoked');
        } else {
            console.log('Lambda Function invocation failed');
        }
    } catch (error) {
        console.error("Error invoking QuickSight update function", error);
        throw error;
    }
}

async function checkDataset() {
    var datasetExists = Boolean;
    const describeDataSet = new DescribeDataSetCommand ({
        AwsAccountId: account,
        DataSetId: datasetId,
    });
    try {
        const response = await quickSightClient.send(describeDataSet);
        console.log("Check dataset response:", response.Status);
        if (response.Status === 200)
            return datasetExists = true;   
        else
            return datasetExists = false;
    } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            return datasetExists = false;
        }
        console.error('Describe Dataset Error: ', error);
    }
}
