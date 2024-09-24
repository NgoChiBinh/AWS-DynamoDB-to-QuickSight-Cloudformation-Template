const getEnv = () => ({
    userPoolId: process.env.USER_POOL_ID,
    region: process.env.REGION,
    awsAccountId: process.env.AWS_ACC_ID,
    nuoaAuthRoleArn: process.env.AUTH_ROLE_ARN,
    identityPoolId: process.env.IDPOOL_ID,
    userPoolClientId: process.env.USER_POOL_CLIENT_ID,
    datasetId: process.env.DATASET,
    adminId: process.env.QUICKSIGHT_ADMIN_ID,
});

module.exports = { getEnv };