const { CognitoIdentityProviderClient, GlobalSignOutCommand } = require("@aws-sdk/client-cognito-identity-provider");

exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const { accessToken } = body;
  const client = new CognitoIdentityProviderClient();

  if (!accessToken) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "Access token is required" }),
    };
  }

  try {
    // Perform global sign-out to invalidate the tokens
    const command = new GlobalSignOutCommand(input);
    const response = await client.send(command);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Logout successful",
        response: response,
      }),
    };
  } catch (error) {
    console.error("Error during logout:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "Logout failed", error: error.message }),
    };
  }
};
