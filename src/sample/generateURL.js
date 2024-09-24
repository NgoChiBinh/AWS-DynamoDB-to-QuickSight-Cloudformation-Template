const aws = require('aws-sdk'); 
// require('dotenv').config();

async function generateEmbedUrl() {
    try {
        // Update your AWS Region if needed
        const cognitoIdentity = new aws.CognitoIdentity({ region: 'ap-southeast-1' });
        const cognito = new aws.CognitoIdentityServiceProvider({ region: 'ap-southeast-1' }); 
        const quicksight = new aws.QuickSight({ region: 'ap-southeast-1' });

        // ========= Login Simulation (Focus on Authentication) =========
        const authParams = {
            AuthFlow: 'USER_PASSWORD_AUTH', 
            ClientId: '1ueg8g84ocuikn2fk8b305af1f', 
            AuthParameters: {
                'USERNAME': 'test-user-2',
                'PASSWORD': 'P@ssw0rd12366' 
            }
        };

        let authResult = await cognito.initiateAuth(authParams).promise();


        // New Password Challenge Handling
        if (authResult.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
            // ... (Your code to handle the new password challenge)
        }

        // Assuming authentication is successful
        const idToken = authResult.AuthenticationResult.IdToken; 
        // console.log("ID Token:", idToken); 

        // ========= Exchange for Credentials =========
        const identityPoolId = 'ap-southeast-1:7a544767-a00e-42b0-8451-42fc1375ceb7';
        console.log("Identity Pool ID:", identityPoolId); 

        const getIdParams = {
            IdentityPoolId: identityPoolId,  
            Logins: {
                'cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_lfkXeZ4pT': idToken 
            }
        }; 
        const idData = await cognitoIdentity.getId(getIdParams).promise();
        console.log("getId Response:", idData); 

        const identityId = idData.IdentityId;

        // ========= Register QuickSight User (if doesn't exist yet) =========
        const registerUserParams = {
            IdentityType: 'IAM',
            AwsAccountId: '203903977784', // Replace with your AWS Account ID   
            Namespace: 'default', // Replace with your QuickSight Namespace
            SessionName: 'READER',
            UserRole: 'READER',
            Email: 'test-user-2+chibinh514e@hotmail.com',  
            IamArn: 'arn:aws:iam::203903977784:role/service-role/quicksight-readers-idpools-authenticated' // Replace with the IAM role ARN
        };

        try {
            // Attempt to describe the user (will throw if the user doesn't exist)
            await quicksight.describeUser({
                UserName: 'quicksight-readers-idpools-authenticated/READER', // Adjust if you use a different naming scheme
                AwsAccountId: '203903977784',
                Namespace: 'default'
            }).promise();

            console.log("User already exists in QuickSight");
        } catch (error) {
            // If describeUser fails, it likely means the user needs registration
            if (error.code === 'ResourceNotFoundException') {  
                await quicksight.registerUser(registerUserParams).promise();
                console.log("User registered in QuickSight");
            } else {
                // Unexpected error during describeUser
                console.error("Error checking for existing user:", error);
                // You might want to handle this differently 
            }
        }

        // ========= Generate Embedding URL =========
        const generateEmbedUrlParams = {
            AwsAccountId: '203903977784', 
            SessionLifetimeInMinutes: 15, 
            UserArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:user/default/quicksight-readers-idpools-authenticated/READER',
            ExperienceConfiguration: {
                Dashboard: { // At a minimum, you need the 'Dashboard' section
                    InitialDashboardId: '3d4f04a8-789d-4237-9d93-25a458a28311' // Your Dashboard ID  
                }
            } 
        };
        const embedUrlResponse = await quicksight.generateEmbedUrlForRegisteredUser(generateEmbedUrlParams).promise();

        console.log("Embed URL:", embedUrlResponse.EmbedUrl);

        console.log("Identity ID:", identityId);

    } catch (error) {
        console.error("Error Generating Dashboard URL:", error);
    }
}

// Call the function to trigger the logic
generateEmbedUrl();  