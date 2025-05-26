/**
 * Database validation utility
 * Checks if required tables exist and initializes default data
 */

/**
 * Validate that required tables exist in the database
 * @param {Object} db - Sequelize database instance
 * @returns {Promise<void>}
 */
async function validateTables(db, requiredTables) {
  try {
    // Check if the required tables exist in the database

    // Get all table names from the db object
    const tableResults = [];
    for (const modelName in db) {
      const model = db[modelName];
      if (model.tableName) {
        tableResults.push({ table_name: model.tableName });
      }
    }
    
    const tableNames = tableResults.map(result => result.table_name.toLowerCase());

    // Check if all required tables exist
    const missingTables = requiredTables.filter(tableName => !tableNames.includes(tableName.toLowerCase()));

    if (missingTables.length > 0) {
      throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
    }
  } catch (error) {
    throw new Error(`Error validating database tables: ${error.message}`);
  }
}

/**
 * Initialize default data in the database
 * @param {Object} db - Sequelize database instance
 * @returns {Promise<void>}
 */
async function setupInitialData(db) {
  try {
    // Define the models
    const AccessGroup = db.AccessGroup || db.access_groups || db.AccessGroups;
    const Permission = db.Permission || db.permissions || db.Permissions;
    const AccessGroupPermission = db.AccessGroupPermission || db.access_group_permissions || db.AccessGroupPermissions;
    
    if (!AccessGroup || !Permission || !AccessGroupPermission) {
      throw new Error('Required models not found in database instance. Make sure the models are properly defined.');
    }

    // Check if super_admin permission exists
    let superAdminPermission = await Permission.findOne({
      where: {
        code: 'super_admin'
      }
    });

    // Create super_admin permission if it doesn't exist
    if (!superAdminPermission) {
      superAdminPermission = await Permission.create({
        code: 'super_admin',
        name: 'Super Admin',
        description: 'Super Admin permission with access to all resources'
      });
    }

    // Check if Super Admin access group exists
    let superAdminGroup = await AccessGroup.findOne({
      where: {
        name: 'Super Admin'
      }
    });

    // Create Super Admin access group if it doesn't exist
    if (!superAdminGroup) {
      superAdminGroup = await AccessGroup.create({
        name: 'Super Admin',
        description: 'Super Admin group with all permissions'
      });
    }

    // Check if Super Admin access group has super_admin permission
    const existingAssignment = await AccessGroupPermission.findOne({
      where: {
        access_group_id: superAdminGroup.id,
        permission_id: superAdminPermission.id
      }
    });

    // Assign super_admin permission to Super Admin access group if not already assigned
    if (!existingAssignment) {
      await AccessGroupPermission.create({
        access_group_id: superAdminGroup.id,
        permission_id: superAdminPermission.id
      });
    }
  } catch (error) {
    throw new Error(`Error setting up initial data: ${error.message}`);
  }
}

module.exports = {
  validateTables,
  setupInitialData
}; 