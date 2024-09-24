const  { 
    IAMClient,
    CreateRoleCommand, 
    PutRolePolicyCommand, 
    GetRoleCommand,
} = require ("@aws-sdk/client-iam");

const { getEnv } = require ('../../getEnv');

const iamClient = new IAMClient({ region: getEnv().region });

async function createTenantRole(tenantName) {
    const roleTenantName = `${tenantName}TenantRole`;
    // Construct the assume role policy document as an object
    const assumeRolePolicyDocument = {
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Principal: {
                    AWS: getEnv().nuoaAuthRoleArn,
                },
                Action: "sts:AssumeRole",
                Condition: {
                    StringEquals: {
                        "sts:ExternalId": tenantName,
                    },
                },
            },
        ],
    };

    // Add permissions to the role (policy document as an object)
    const rolePolicyName = `${roleTenantName}Policy`;
    const policyDocument = {
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
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
    };

    try {
        const createRoleCommnand = new CreateRoleCommand({
            RoleName: roleTenantName,
            AssumeRolePolicyDocument:JSON.stringify(assumeRolePolicyDocument),
            Description: `Role for ${tenantName}`,
        });

        const createRoleResponse = await iamClient.send(createRoleCommnand);
        console.log('createRoleResponse: ', createRoleResponse);
        const roleArn = createRoleResponse.Role.Arn;

        console.log(`Role created: ${roleArn}`);

        // Add Role Policies
        const putRolePolicyCommand = new PutRolePolicyCommand({
            RoleName: roleTenantName,
            PolicyName: rolePolicyName,
            PolicyDocument: JSON.stringify(policyDocument),
        });
        await iamClient.send(putRolePolicyCommand);

        console.log(`${rolePolicyName} policy attached to role: ${roleTenantName}; ARN: ${roleArn}`);
        await waitForRoleCreation(roleTenantName);
        return roleArn;
    } catch (error) {
        if (error.name === 'EntityAlreadyExistsException') {
            console.error("Role already exists.");
            return `arn:aws:iam::${getEnv().awsAccountId}:role/${tenantName}TenantRole`;
        } else {
            console.error("Error creating tenant role:", error);
            throw error; 
        }
    }
};

async function waitForRoleCreation(roleName, retryDelay = 2000, maxRetries = 10) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const command = new GetRoleCommand({ RoleName: roleName });
            await iamClient.send(command); 
            return; 
        } catch (error) {
            if (error.name === "NoSuchEntityException") {
                retries++;
                await new Promise(resolve => setTimeout(resolve, retryDelay)); // Retry after delay
            } else if (error.name === 'EntityAlreadyExistsException') {
                console.log('Role already exists');
                return;
            } else {
                throw error;
            }
        }
    }
    throw new Error(`Role creation timed out after ${maxRetries} retries`);
};

module.exports = { createTenantRole, waitForRoleCreation };