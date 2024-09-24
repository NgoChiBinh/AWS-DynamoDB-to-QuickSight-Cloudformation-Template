const { generateQuickSightURL } = require("./fetchUserRelatedInfo");

exports.generateDashboardUrl = async (event) => {
  try {
    const authorizationHeader =
      event.headers.authorization || event.headers.Authorization;

    if (!authorizationHeader) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Missing Authorization header" }),
      };
    }

    // Check if the header follows the Bearer <token> format
    const tokenParts = authorizationHeader.split(" ");
    if (tokenParts[0] !== "Bearer" || tokenParts.length !== 2) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: "Invalid Authorization header format",
        }),
      };
    }

    // Extract the token
    const accessToken = tokenParts[1];
    // Generate QuickSight embedded URL
    const embedUrl = await generateQuickSightURL(accessToken);
    console.log("Quicksight Embeded URL: ", embedUrl);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Lambda execution successful!",
        embedUrl: embedUrl,
      }),
    };
  } catch (error) {
    console.error("Error in Lambda execution:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Something went wrong: ${error.message}`,
      }),
    };
  }
};
