'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('gle_incident_reports', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'gle_tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'gle_users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      location: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      intervention_type: {
        type: Sequelize.ENUM(
          'medical',
          'fire',
          'traffic',
          'structural',
          'other',
        ),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('step_1', 'completed'),
        allowNull: false,
        defaultValue: 'step_1',
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
    });

    await queryInterface.addIndex('gle_incident_reports', ['tenant_id']);
    await queryInterface.addIndex('gle_incident_reports', ['user_id']);
    await queryInterface.addIndex('gle_incident_reports', ['tenant_id', 'status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('gle_incident_reports');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_gle_incident_reports_intervention_type";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_gle_incident_reports_status";',
    );
  },
};
