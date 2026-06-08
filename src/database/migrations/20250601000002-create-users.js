'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('gle_users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'gle_tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('admin', 'agent'),
        allowNull: false,
        defaultValue: 'agent',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('gle_users');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_gle_users_role";',
    );
  },
};
