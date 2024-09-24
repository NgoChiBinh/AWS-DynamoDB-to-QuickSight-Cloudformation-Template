import { 
    IAMClient, 
    CreateRoleCommand, 
    PutRolePolicyCommand, 
    GetRoleCommand 
} from '@aws-sdk/client-iam';
import { mockClient } from 'aws-sdk-client-mock';

const { createTenantRole, waitForRoleCreation } = require('../src/lambda-code/onboarding/helpers/createTenant/createTenantRole');
const { getEnv } = require('../src/lambda-code/onboarding/getEnv');

import { EntityAlreadyExistsException, NoSuchEntityException } from '@aws-sdk/client-iam';
import 'aws-sdk-client-mock-jest';

// Mock the IAMClient and its methods
const mockIamClient = mockClient(IAMClient);

jest.mock('../src/lambda-code/onboarding/getEnv', () => ({
    getEnv: jest.fn(() => ({
        region: 'ap-southeast-1',
        awsAccountId: '123456789012',
        nuoaAuthRoleArn: 'arn:aws:iam::123456789012:role/nuoa-auth-role',
    })),
}));

describe('createTenantRole', () => {
    beforeEach(() => {
        mockIamClient.reset();
    });

    it('should create a new role and policy when the role does not exist', async () => {
        const tenantName = 'test';
        const roleTenantName = `${tenantName}TenantRole`;
        const rolePolicyName = `${roleTenantName}Policy`;

        // Mock CreateRoleCommand response
        mockIamClient
            .on(CreateRoleCommand)
            .resolves({ Role: {
                Arn: `arn:aws:iam::123456789012:role/${roleTenantName}`,
                Path: "/",                 // Add the missing Path property
                RoleName: roleTenantName, // Add the missing RoleName property
                RoleId: "AROAX5EXAMPLE",   // Add a mock RoleId
                CreateDate: new Date(),   // Add a mock CreateDate
            }});

        mockIamClient.on(PutRolePolicyCommand).resolves({}); // Mock PutRolePolicyCommand response
        mockIamClient.on(GetRoleCommand).resolves({}); // Mock GetRoleCommand response
        const roleArn = await createTenantRole(tenantName); // Call createTenantRole

        // Assertion for CreateRoleCommand 
        expect(mockIamClient).toHaveReceivedCommandWith(CreateRoleCommand, { 
            RoleName: roleTenantName,
            AssumeRolePolicyDocument: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: {
                            AWS: getEnv().nuoaAuthRoleArn,
                        },
                        Action: 'sts:AssumeRole',
                        Condition: {
                            StringEquals: {
                                'sts:ExternalId': tenantName,
                            },
                        },
                    },
                ],
            }),
            Description: `Role for ${tenantName}`,
        });
        // Assertion for PutRolePolicyCommand 
        expect(mockIamClient).toHaveReceivedCommandWith(PutRolePolicyCommand, {
            RoleName: roleTenantName,
            PolicyName:rolePolicyName,
            PolicyDocument: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: [
                            "quicksight:DescribeDashboard",
                            "quicksight:ListDashboards",
                            "quicksight:GetDashboardEmbedUrl",
                            "quicksight:GenerateEmbedUrlForRegisteredUser",
                            "quicksight:RegisterUser",
                        ],
                        Resource: [`arn:aws:quicksight:${getEnv().region}:${getEnv().awsAccountId}:namespace/${tenantName}`],
                    },
                ],
            }),
        });
        // Assertion for roleARN
        expect(roleArn).toBe(`arn:aws:iam::123456789012:role/${roleTenantName}`);
    });


    it('should handle EntityAlreadyExistsException gracefully', async () => {
        const tenantName = 'existingTenant';
        const existingRoleArn = `arn:aws:iam::${getEnv().awsAccountId}:role/${tenantName}TenantRole`;
        const errorMessage = 'Role already exists.'

        // Create mock reject response
        mockIamClient.on(CreateRoleCommand).rejects(new EntityAlreadyExistsException({  
            message: errorMessage, 
            $metadata: {},
        }));
        const consoleErrorSpy = jest.spyOn(console, 'error'); // Spy on console.error
        // Call the createTenantRole function
        const result = await createTenantRole(tenantName);
        // Assertions
        expect(consoleErrorSpy).toHaveBeenCalledWith(errorMessage);
        expect(result).toBe(existingRoleArn);
        consoleErrorSpy.mockRestore();
    });
});

describe('waitForRoleCreation', () => {
    beforeEach(() => {
        mockIamClient.reset();
    });

    it('should retry and eventually find the role', async () => {
      const roleName = 'newRole';
      let callCount = 0; 
  
      // Mock GetRoleCommand to fail initially, then succeed on a later call
      mockIamClient.on(GetRoleCommand).callsFake(() => {
        callCount++;
        if (callCount < 3) { // Simulate failure for first two calls
          throw new NoSuchEntityException({ message: 'Not found', $metadata: {} });
        } else {
          return { Role: { Arn: `arn:aws:iam::123456789012:role/${roleName}` } };
        }
      });
      await waitForRoleCreation(roleName, 500, 5); // Shorten delays/retries for testing
      expect(mockIamClient).toHaveReceivedCommandTimes(GetRoleCommand, 3); // Ensure retries occurred
    });
    
  
    it('should throw an error after max retries', async () => {
      const roleName = 'nonExistentRole';
      mockIamClient.on(GetRoleCommand).rejects(new NoSuchEntityException({ message: 'Not found', $metadata: {} }));
      await expect(waitForRoleCreation(roleName, 500, 3)).rejects.toThrow('Role creation timed out after 3 retries');
      expect(mockIamClient).toHaveReceivedCommandTimes(GetRoleCommand, 3);
    });


    it('should return immediately if the role already exists (EntityAlreadyExistsException)', async () => {
        const roleName = 'existingRole';
        mockIamClient.on(GetRoleCommand).rejects(new EntityAlreadyExistsException({ message: 'Role already exists', $metadata: {} }));
        const consoleLogSpy = jest.spyOn(console, 'log'); // Spy on console.log
        await waitForRoleCreation(roleName, 500, 5); // Shorten delays/retries for testing
        expect(consoleLogSpy).toHaveBeenCalledWith('Role already exists');
        expect(mockIamClient).toHaveReceivedCommandTimes(GetRoleCommand, 1); // No retries
        consoleLogSpy.mockRestore(); // Clean up the spy
    });

  
    it('should re-throw unexpected errors', async () => {
      const roleName = 'errorRole';
      mockIamClient.on(GetRoleCommand).rejects(new Error('Unexpected error'));
      await expect(waitForRoleCreation(roleName)).rejects.toThrow('Unexpected error');
    });
  });
