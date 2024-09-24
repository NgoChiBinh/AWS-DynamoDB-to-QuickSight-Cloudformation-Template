const { 
    CognitoIdentityClient,
    SetIdentityPoolRolesCommand, 
    GetIdentityPoolRolesCommand 
} = require ("@aws-sdk/client-cognito-identity");

const { getEnv } = require ('../../getEnv');

const cognitoIdentityClient = new CognitoIdentityClient({ region: getEnv().region });

async function createRoleMapping(tenantName, tenantRoleArn) {
    console.log('Inside createRoleMapping: tenantRoleArn: ', tenantRoleArn);

// 1. Get Existing Role Mappings
    const getIdentityPoolRolesCommandInput = new GetIdentityPoolRolesCommand({
        IdentityPoolId: getEnv().identityPoolId
    });
    const currentRolesResponse = await cognitoIdentityClient.send(getIdentityPoolRolesCommandInput);
    const existingRoleMappings = currentRolesResponse.RoleMappings || {};

// 2. Retrieve Existing Rules or Create New Array
    const cognitoResourceId = `cognito-idp.${getEnv().region}.amazonaws.com/${getEnv().userPoolId}:${getEnv().userPoolClientId}`;
    const existingRules = existingRoleMappings[cognitoResourceId]?.RulesConfiguration?.Rules || []; // Extract existing rules or initialize an empty array

// 3. Check if Rule Already Exists
  const ruleExists = existingRules.some(rule => 
    rule.Claim === 'cognito:groups' && 
    rule.MatchType === 'Equals' && 
    rule.Value === tenantName && 
    rule.RoleARN === tenantRoleArn
  );

  if (ruleExists) {
    console.log('Rule already exists, skipping creation.');
    return; // Exit the function early
  }

// 4. Append New Rule to Existing Rules
    existingRules.push({
        Claim: 'cognito:groups',
        MatchType: 'Equals',
        Value: tenantName,
        RoleARN: tenantRoleArn
    });

// 4. Update (or Create) Rule Configuration
    existingRoleMappings[cognitoResourceId] = {
        Type: 'Rules',
        AmbiguousRoleResolution: 'Deny',
        RulesConfiguration: {
            Rules: existingRules
        }
    };

// 5. Set Updated Role Mappingsd
    const params = {
        IdentityPoolId: getEnv().identityPoolId,
        Roles: {
            authenticated: getEnv().nuoaAuthRoleArn
        },
        RoleMappings: existingRoleMappings,
    };

    try {
        const command = new SetIdentityPoolRolesCommand(params);
        const response = await cognitoIdentityClient.send(command);
        console.log("Identity Pool roles configured successfully:", response);
    } catch (error) {
        console.log('Error:', error.message);
        if (error.name === 'InvalidParameterException') {
            console.error("Invalid parameters:", error.message);
            throw error;
        } else if (error.name === 'ResourceNotFoundException') {
            console.error("Identity pool or role not found:", error.message);
            throw error;
        } else if (error.name === 'NotAuthorizedException') {
            console.error("Not authorized to perform this action:", error.message);
            throw error;
        } else {
            console.error("Unexpected error:", error);
            throw error;
        }
    }
};

module.exports = { createRoleMapping };