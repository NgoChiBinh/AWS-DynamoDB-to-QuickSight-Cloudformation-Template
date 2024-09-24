import { 
    QuickSightClient,
    DescribeDashboardCommand,
    DescribeNamespaceCommand,
    DescribeTemplateCommand,
    DescribeAnalysisCommand,
    ResourceExistsException,
    CreateDashboardCommand,
    CreateNamespaceCommand,
    CreateTemplateCommand,
    CreateAnalysisCommand,
} from '@aws-sdk/client-quicksight';
import { mockClient } from 'aws-sdk-client-mock';

const { createQuickSightResource } = require('../src/lambda-code/onboarding/helpers/createDashboard/createResource');

const mockQuickSightClient = mockClient(QuickSightClient);

const testCases: [string, any, any, any][] = [
    ['Template', CreateTemplateCommand,DescribeTemplateCommand, { AwsAccountId: '123456789012', TemplateId: 'test-template', Name: 'Test Template' }],
    ['Dashboard', CreateDashboardCommand, DescribeDashboardCommand, { AwsAccountId: '123456789012', DashboardId: 'test-dashboard', Name: 'Test Dashboard' }],
    ['Namespace', CreateNamespaceCommand, DescribeNamespaceCommand, { AwsAccountId: '123456789012', Namespace: 'test-namespace' , IdentityStore: 'QUICKSIGHT'}],
    ['Analysis', CreateAnalysisCommand, DescribeAnalysisCommand, { AwsAccountId: '123456789012', AnalysisId: 'test-analysis' , Name: 'Test Analysis' }],
];

describe('createQuickSightResource', () => {

    beforeEach(() => {
        mockQuickSightClient.reset();
    });

    describe.each(testCases)('for %s resource', (resourceType, createCommandConstructor, describeCommand, resourceParams) => {
        it(`should create a ${resourceType} and wait for it to be ready`, async () => {
            mockQuickSightClient.on(createCommandConstructor).resolves({});
            mockQuickSightClient.on(describeCommand).resolves({ 
                [resourceType]:
                {
                    [resourceType === 'Namespace' ? resourceType : resourceType + 'Id']: resourceParams[ resourceType === 'Namespace' ? resourceType : resourceType + 'Id'],
                    // Adjust the response based on the resource type:
                    ...(resourceType === 'Template' ? { Version: { Status: 'CREATION_SUCCESSFUL' } } 
                        : resourceType === 'Dashboard' ? { Version: { Status: 'CREATION_SUCCESSFUL' } } 
                        : resourceType === 'Namespace' ? { CreationStatus: 'CREATED' }
                        : resourceType === 'Analysis' ? { Status: 'CREATION_SUCCESSFUL' }
                        : {}),
                },
            });
    
            const createResource = createQuickSightResource(resourceType, createCommandConstructor);
            const response = await createResource(resourceParams);
    
            expect(mockQuickSightClient.commandCalls(createCommandConstructor)[0].args[0].input).toEqual(resourceParams);
            expect(mockQuickSightClient.commandCalls(describeCommand)[0].args[0].input).toMatchObject({
                AwsAccountId: '123456789012',
                [resourceType === 'Namespace' ? resourceType : resourceType + 'Id']: resourceParams[resourceType === 'Namespace' ? resourceType : resourceType + 'Id'],
            });
        });


        it(`should handle ${resourceType} creation failure`, async () => {
    
            // Mock Create commands
            mockQuickSightClient.on(createCommandConstructor).resolves({});
    
            // Mock Describe commands to return "CREATION_FAILED" after a few calls
            mockQuickSightClient
            .on(describeCommand)
            .resolves({ 
                [resourceType]:
                {
                    [resourceType === 'Namespace' ? resourceType : resourceType + 'Id']: resourceParams[ resourceType === 'Namespace' ? resourceType : resourceType + 'Id'],
                    // Adjust the response based on the resource type:
                    ...(resourceType === 'Template' ? { Version: { Status: 'CREATION_FAILED' } } 
                        : resourceType === 'Dashboard' ? { Version: { Status: 'CREATION_FAILED' } } 
                        : resourceType === 'Namespace' ? { CreationStatus: 'NON_RETRYABLE_FAILURE' }
                        : resourceType === 'Analysis' ? { Status: 'CREATION_FAILED' }
                        : {}),
                },
            });
    
            const createResource = createQuickSightResource(resourceType, createCommandConstructor);
    
            await expect(createResource(resourceParams)).rejects.toThrow(`Operation failed with status: ${resourceType === 'Namespace' ? 'NON_RETRYABLE_FAILURE' : 'CREATION_FAILED'}`); // Or your custom error message

        });
        


        it('should handle ResourceExistsException', async () => {
            // Simulate ResourceExistsException
            mockQuickSightClient.on(createCommandConstructor).rejects(new ResourceExistsException({ 
                message: 'Resource already exists', 
                $metadata:{} 
            }));
    
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const createResource = createQuickSightResource(resourceType, createCommandConstructor);
            await createResource(resourceParams);
            expect(consoleWarnSpy).toHaveBeenCalledWith(`${resourceType} already exists. Moving on...`);
        });


        it('should throw generic Error', async () => {
            // Simulate generic error (replace with an actual Error subclass)
            const errorMessage = "Some unexpected error occurred";
            mockQuickSightClient.on(createCommandConstructor).rejects(new Error(errorMessage));
        
            await expect(createQuickSightResource(resourceType, createCommandConstructor)).rejects.toThrow(errorMessage);
        });
    });
});

