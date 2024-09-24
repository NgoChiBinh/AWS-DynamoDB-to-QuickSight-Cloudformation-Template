const { createQSDashboard } = require('./helpers/createDashboard/createDashboard');
const { createTenant } = require('./helpers/createTenant/createTenant');
const { invokeUpdateRLS } = require('./helpers/updateRLSTable/invokeUpdateRLS');

exports.quicksightOnboarding = async (event) => {
    const tenant = event.detail.requestParameters.groupName;
    const email = `${tenant}@hotmail.com`;
    const tenantid = event.tenantid;
    console.log('Tenant: ', tenant);
// ========= Create Tenant Group =========
    const tenantRoleArn = await createTenant(tenant);

// ========= Create Dashboard and Invite User =========
    const userArn = await createQSDashboard(tenant, email, tenantRoleArn);

// ========= Update RLS Table with Tenant's UserARN and tenantid =========
    await invokeUpdateRLS(tenant, tenantid);
};

