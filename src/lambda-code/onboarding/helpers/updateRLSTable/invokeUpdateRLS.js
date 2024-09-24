const {
    InvokeCommand,
    LambdaClient
} = require('@aws-sdk/client-lambda')
const { fromUtf8 } = require("@aws-sdk/util-utf8-node");

const region = process.env.REGION;
const updateRLSTableFuncArn = process.env.UPDATE_RLS_ARN;
const lambdaClient = new LambdaClient({ region: region });

async function invokeUpdateRLS (tenant, tenantid) {

    const payload = {   
        tenant: tenant,
        tenantid: tenantid,
    };
    
    const invokeUpdate = new InvokeCommand({
        FunctionName: updateRLSTableFuncArn,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
        Payload: fromUtf8(JSON.stringify(payload)), 
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

module.exports = { invokeUpdateRLS };