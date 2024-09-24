const { createTenantRole } = require ('./createTenantRole');
const { createRoleMapping } = require ('./createRoleMapping');

async function createTenant(tenantName) {
    const tenantRoleArn = await createTenantRole(tenantName);
    console.log('Tennant role arn: ', tenantRoleArn);
    await createRoleMapping(tenantName, tenantRoleArn);
    return tenantRoleArn;
};

module.exports = { createTenant };
