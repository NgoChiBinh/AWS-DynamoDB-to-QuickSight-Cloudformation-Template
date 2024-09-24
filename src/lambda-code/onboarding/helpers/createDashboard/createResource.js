const { 
    QuickSightClient,
    DescribeDashboardCommand,
    DescribeNamespaceCommand,
    DescribeTemplateCommand,
    DescribeAnalysisCommand,
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
            case 'template':
              describeParams.TemplateId = resourceParams.TemplateId;
              break;
            case 'dashboard':
              describeParams.DashboardId = resourceParams.DashboardId;
              break;
            case 'namespace':
              describeParams.Namespace = resourceParams.Namespace;
              break;
            case 'analysis':
              describeParams.AnalysisId = resourceParams.AnalysisId;
              break;
            default:
              break;
          }
          await waitForQuickSightOperation(
            resourceType,
            describeParams,
            ["CREATION_SUCCESSFUL", "CREATED"] // Adjust if needed for specific resource type
          );
        }
  
        console.log(`${resourceType} ${resourceParams.Name || resourceParams.TemplateId} created`);
        return response;
      } catch (error) {
        if (error.name === "ResourceExistsException" || error.name === "ConflictException") {
          console.warn(`${resourceType} already exists. Moving on...`);
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

        switch (resourceType.toLowerCase()) {
            case 'dashboard':
                command = new DescribeDashboardCommand(params);
                statusPath = 'Dashboard.Version.Status';
                break;
            case 'namespace':
                command = new DescribeNamespaceCommand(params);
                statusPath = 'Namespace.CreationStatus';
                break;
            case 'template':
                command = new DescribeTemplateCommand(params);
                statusPath = 'Template.Version.Status';
                break;
            case 'analysis':
                command = new DescribeAnalysisCommand(params);
                statusPath = 'Analysis.Status';
                break;
            default:
                throw new Error(`Unsupported resource type: ${resourceType}`);
        }

        const response = await quickSightClient.send(command);
        const status = statusPath.split('.').reduce((obj, key) => obj[key], response);
        if (desiredStatuses.includes(status)) {
            return response;
        } else if (status === ("CREATION_FAILED") || status === 'NON_RETRYABLE_FAILURE') {
            throw new Error(`Operation failed with status: ${status}`);
        }

        retries++;
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    throw new Error(`Operation timed out after ${maxRetries} retries`);
};

