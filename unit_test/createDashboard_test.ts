import {  
    CreateNamespaceCommand,
    CreateNamespaceCommandInput,
    CreateTemplateCommand,
    CreateTemplateCommandInput,
    CreateAnalysisCommand,
    CreateAnalysisCommandInput,
    CreateDashboardCommand,
    CreateDashboardCommandInput,
    RegisterUserCommand,
    RegisterUserCommandInput,
    QuickSightClient,
} from '@aws-sdk/client-quicksight';
import { mockClient } from 'aws-sdk-client-mock';

const { createQSDashboard } = require('../src/lambda-code/onboarding/helpers/createDashboard/createDashboard');
const { createQuickSightResource } = require('../src/lambda-code/onboarding/helpers/createDashboard/createResource');
const { getEnv } = require ('../src/lambda-code/onboarding/getEnv');

jest.mock('../src/lambda-code/onboarding/getEnv', () => ({
    getEnv: jest.fn(() => ({
        region: 'ap-southeast-1', // Example values
        awsAccountId: '123456789012',
        datasetId: 'MOCK_DATASET_ID',
        adminId: 'mockQSAdminID',
    })),
}));

jest.mock('../src/lambda-code/onboarding/helpers/createDashboard/createResource', () => ({
    createQuickSightResource: jest.fn().mockImplementation((resourceType) => {
        // Simulate successful resource creation based on the type
        return (params: 
            CreateNamespaceCommandInput | 
            CreateTemplateCommandInput | 
            CreateAnalysisCommandInput | 
            CreateDashboardCommandInput |
            RegisterUserCommandInput
        ) => Promise.resolve(
            {
            Status: 200, // Or other relevant status codes
            // Reponse to CreateNameSpaceCommand
            ...(resourceType === 'Namespace' && {
                Namespace: {
                    Arn: `arn:aws:quicksight:us-east-1:123456789012:namespace/${(params as CreateNamespaceCommandInput).Namespace}`,
                    Name: (params as CreateNamespaceCommandInput).Namespace,
                    CreationStatus: 'CREATED', // or other relevant statuses
                    IdentityStore: (params as CreateNamespaceCommandInput).IdentityStore,
                }
            }),
            // Response to CreateTemplateCommand
            ...(resourceType === 'Template' && {
                TemplateId: (params as CreateTemplateCommandInput).TemplateId,
                Arn: `arn:aws:quicksight:us-east-1:123456789012:template/${(params as CreateTemplateCommandInput).TemplateId}`,
                Name: (params as CreateTemplateCommandInput).Name,
                Version: {
                    Status: 'CREATION_SUCCESSFUL',
                }
            }),
            // Response to CreateAnalysisCommand
            ...(resourceType === 'Analysis' && {
                AnalysisId: (params as CreateAnalysisCommandInput).AnalysisId,
                Arn: `arn:aws:quicksight:us-east-1:123456789012:analysis/${(params as CreateAnalysisCommandInput).AnalysisId}`,
                Name: (params as CreateAnalysisCommandInput).Name,
                Status: 'CREATION_SUCCESSFUL', // or other relevant statuses
            }),
            // Response to CreateDashboardCommand
            ...(resourceType === 'Dashboard' && {
                DashboardId: (params as CreateDashboardCommandInput).DashboardId,
                Arn: `arn:aws:quicksight:us-east-1:123456789012:dashboard/${(params as CreateDashboardCommandInput).DashboardId}`,
                Name: (params as CreateDashboardCommandInput).Name,
                Version: {
                    Status: 'CREATION_SUCCESSFUL',
                }
            }),
            // Response to RegisterUserCommand
            ...(resourceType === 'User' && {
                User: {
                    Arn: `arn:aws:quicksight:us-east-1:123456789012:user/default/${(params as RegisterUserCommandInput).Email}`,
                    Email: (params as RegisterUserCommandInput).Email,
                    Role: (params as RegisterUserCommandInput).UserRole,
                    Active: true, // or other relevant statuses
                },
                RequestId: 'mock-request-id', // Example
            }),
        });
    }),
}));

const mockQuickSightClient = mockClient(QuickSightClient);

describe('createQSDashboard', () => {
    beforeEach(() => {
        mockQuickSightClient.reset();
    });

    it('should creates QuickSight resources successfully', async () => {
        const tenant = 'my-tenant';
        const email = 'user@example.com';
        const tenantRoleArn = 'arn:aws:iam::123456789012:role/my-role';

        await createQSDashboard(tenant, email, tenantRoleArn);

        // Assert that createQuickSightResource was called for each resource type
        expect(createQuickSightResource).toHaveBeenCalledWith('Namespace', CreateNamespaceCommand);
        expect(createQuickSightResource).toHaveBeenCalledWith('Template', CreateTemplateCommand);
        expect(createQuickSightResource).toHaveBeenCalledWith('Analysis', CreateAnalysisCommand);
        expect(createQuickSightResource).toHaveBeenCalledWith('Dashboard', CreateDashboardCommand);
        expect(createQuickSightResource).toHaveBeenCalledWith('User', RegisterUserCommand);
    });
});


