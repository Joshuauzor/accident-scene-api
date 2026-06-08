'use strict';

const crypto = require('crypto');

module.exports = {
  async up(queryInterface) {
    const tenant_id = crypto.randomUUID();
    const admin_id = crypto.randomUUID();
    const now = new Date();

    await queryInterface.bulkInsert('gle_tenants', [
      {
        id: tenant_id,
        name: 'Default',
        slug: 'default',
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('gle_users', [
      {
        id: admin_id,
        tenant_id,
        email: 'admin@example.com',
        password: '$2b$10$2wzRAPwlZT10FrO6GCRifO3AHC.4Ph1MdtBhARhntyCsK.FhW7nDm',
        role: 'admin',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('gle_users', {
      email: 'admin@example.com',
    });
    await queryInterface.bulkDelete('gle_tenants', {
      slug: 'default',
    });
  },
};
