const { 
    QuickSightClient,
    DescribeDataSetCommand,
    DescribeDataSourceCommand,
} = require('@aws-sdk/client-quicksight');

const region = process.env.REGION;

const quickSightClient = new QuickSightClient({ region: region });

function createQuickSightResource(resourceType, createCommandConstructor) {
    return async function (resourceParams) {
      const command = new createCommandConstructor(resourceParams);

      try {
        const response = await quickSightClient.send(command);
        
        if (resourceType !== 'User') {
          // After creation, immediately wait for the resource to be ready
          const describeParams = {
            AwsAccountId: resourceParams.AwsAccountId,
          };

          switch (resourceType.toLowerCase()) {
            case 'datasource':
              describeParams.DataSourceId = resourceParams.DataSourceId;
              break;
            case 'dataset':
              describeParams.DataSetId = resourceParams.DataSetId;
              break;
            default:
              break;
          }
          await waitForQuickSightOperation(
            resourceType,
            describeParams,
            ["CREATION_SUCCESSFUL", 200] // Adjust if needed for specific resource type
          );
        }
  
        console.log(`${resourceType} ${resourceParams.Name || resourceParams.TemplateId} created`);
        return response;
      } catch (error) {
        if (error.name === "ResourceExistsException" || error.name === "ConflictException") {
          console.warn(`${resourceType} already exists. Moving on...`);
          return;
        } else {
          console.error(`Error creating ${resourceType}: `, error);
          throw error;
        }
      }
    };
  }
module.exports = { createQuickSightResource };

async function waitForQuickSightOperation(
    resourceType, 
    params, 
    desiredStatuses, 
    retryDelay = 5000, 
    maxRetries = 20
) {
    let retries = 0;
    while (retries < maxRetries) {
        let command;
        let statusPath;
        let status;
        switch (resourceType.toLowerCase()) {
            case 'datasource':
                command = new DescribeDataSourceCommand(params);
                statusPath = 'DataSource.Status';
                break;
            case 'dataset':
                command = new DescribeDataSetCommand(params);
                statusPath = 'Status';
                break;
            default:
                throw new Error(`Unsupported resource type: ${resourceType}`);
        }

        const response = await quickSightClient.send(command);

        status = statusPath.split('.').reduce((obj, key) => obj[key], response);
        console.log("Status: ", status);
        if (desiredStatuses.includes(status)) {
            return response;
        } else if (status === ("CREATION_FAILED") || status === 400) {
            throw new Error(`Operation failed with status: ${status}`);
        }
        retries++;
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    throw new Error(`Operation timed out after ${maxRetries} retries`);
};

