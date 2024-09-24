import { 
    CognitoIdentityClient, 
    SetIdentityPoolRolesCommand, 
    GetIdentityPoolRolesCommand, 
    InvalidParameterException, 
    ResourceNotFoundException, 
    NotAuthorizedException, 
    GetIdentityPoolRolesCommandOutput
} from '@aws-sdk/client-cognito-identity';
import { mockClient } from 'aws-sdk-client-mock';

const { createRoleMapping } = require ('../src/lambda-code/onboarding/helpers/createTenant/createRoleMapping');
const { getEnv } = require ('../src/lambda-code/onboarding/getEnv');

jest.mock('../src/lambda-code/onboarding/getEnv', () => ({
    getEnv: jest.fn(() => ({
        region: 'ap-southeast-1', // Example values
        awsAccountId: '123456789012',
        identityPoolId: 'YOUR_IDENTITY_POOL_ID',
        userPoolId: 'YOUR_USER_POOL_ID',
        userPoolClientId: 'YOUR_USER_POOL_CLIENT_ID',
        nuoaAuthRoleArn: 'arn:aws:iam::123456789012:role/nuoa-auth-role',
    })),
}));

const mockCognitoClient = mockClient(CognitoIdentityClient);


describe('createRoleMapping', () => {
    beforeEach(() => {
        mockCognitoClient.reset(); // Reset the mock before each test

        // GetIdentityPoolRolesCommandOutput 
        const getParams: GetIdentityPoolRolesCommandOutput = {
            RoleMappings: { // RoleMappingMap
                "<keys>": { // RoleMapping
                    Type: "Rules", // required
                    RulesConfiguration: { // RulesConfigurationType
                        Rules: [],
                    },
                },
            },
            $metadata: {},
        };
        // Mock GetIdentityPoolRolesCommand before every test
        mockCognitoClient.on(GetIdentityPoolRolesCommand).resolves(getParams);
    });

    it("should create a new role mapping if it doesn't exist", async () => {
        // Mock role mapping cognito resource id
        const mockCognitoResourceId = `cognito-idp.${getEnv().region}.amazonaws.com/${getEnv().userPoolId}:${getEnv().userPoolClientId}`;
        
        // Mock SetIdentityPoolRolesCommand to succeed
        mockCognitoClient.on(SetIdentityPoolRolesCommand).resolves({});
        await createRoleMapping("newTenant", "newTenantRoleArn"); // Sample values
        // Assert that SetIdentityPoolRolesCommand was called with the correct parameters
        const setRolesCommand = await mockCognitoClient.commandCalls(SetIdentityPoolRolesCommand)[0].args[0].input;
        // Assertions
        expect(setRolesCommand).toHaveProperty('RoleMappings');
        expect(setRolesCommand.RoleMappings?.[mockCognitoResourceId]?.RulesConfiguration?.Rules).toEqual(expect.arrayContaining([
            expect.objectContaining({ Claim: 'cognito:groups', Value: 'newTenant', RoleARN: 'newTenantRoleArn' })
        ]))
    });

    it("should skip creating a role mapping if the rule already exists", async () => {
        // Mock GetIdentityPoolRolesCommand to return an existing role mapping
        const mockCognitoResourceId = `cognito-idp.${getEnv().region}.amazonaws.com/${getEnv().userPoolId}:${getEnv().userPoolClientId}`;
    
        mockCognitoClient.on(GetIdentityPoolRolesCommand).resolves({
            RoleMappings: {
                [mockCognitoResourceId]: {
                    Type: "Rules",
                    RulesConfiguration: {
                        Rules: [
                            {
                                Claim: "cognito:groups",
                                MatchType: "Equals",
                                Value: "existingTenant", // Example existing tenant
                                RoleARN: "existingTenantRoleArn",
                            },
                        ],
                    },
                },
            },
        });
        // Mock SetIdentityPoolRolesCommand (not expected to be called)
        mockCognitoClient.on(SetIdentityPoolRolesCommand).resolves({});
        // Call the function with an existing rule
        await createRoleMapping("existingTenant", "existingTenantRoleArn");
        // Assertions
        expect(mockCognitoClient.commandCalls(SetIdentityPoolRolesCommand)).toHaveLength(0); // Verify SetIdentityPoolRolesCommand was NOT called
    });


    it("should throw InvalidParameterException on invalid input", async () => {
        // Simulate InvalidParameterException
        mockCognitoClient.on(GetIdentityPoolRolesCommand).rejects(
            new InvalidParameterException({
                message: "Some parameter is invalid",
                $metadata: {},
            })
        );
        await expect(createRoleMapping("newTenant", "newTenantRoleArn")).rejects.toThrow(InvalidParameterException);
    });

    it("should throw ResourceNotFoundException on missing identity pool", async () => {
        // Simulate ResourceNotFoundException
        mockCognitoClient.on(SetIdentityPoolRolesCommand).rejects(
            new ResourceNotFoundException({
                message: "Identity pool not found",
                $metadata: {},
            })
        );
        await expect(createRoleMapping("newTenant", "newTenantRoleArn")).rejects.toThrow(ResourceNotFoundException);
    });


    it("should throw NotAuthorizedException on permission error", async () => {
        // Simulate NotAuthorizedException
        mockCognitoClient.on(SetIdentityPoolRolesCommand).rejects(
            new NotAuthorizedException({
                message: "Not authorized to perform this action",
                $metadata: {},
            })
        );
        await expect(createRoleMapping("newTenant", "newTenantRoleArn")).rejects.toThrow(NotAuthorizedException);
    });


    it("should throw generic error for other unexpected errors", async () => {
        // Simulate generic error (replace with an actual Error subclass)
        const errorMessage = "Some unexpected error occurred";
        mockCognitoClient.on(SetIdentityPoolRolesCommand).rejects(new Error(errorMessage));
    
        // Assert that the function throws an error (or your custom error type if applicable)
        await expect(createRoleMapping("newTenant", "newTenantRoleArn")).rejects.toThrow(errorMessage);  
    });
});