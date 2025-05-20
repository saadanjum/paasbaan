/**
 * Access Groups Manager utility
 * Handles operations related to access groups, permissions, and user assignments
 */

class AccessGroupsManager {
  /**
   * @constructor
   * @param {Object} db - Sequelize database instance
   */
  constructor(db) {
    if (!db) {
      throw new Error('Database instance is required');
    }

    this.db = db;
    this.AccessGroup = db.AccessGroup || db.access_groups || db.AccessGroups;
    this.Permission = db.Permission || db.permissions || db.Permissions;
    this.AccessGroupPermission = db.AccessGroupPermission || db.access_group_permissions || db.AccessGroupPermissions;
    this.AccessGroupUser = db.AccessGroupUser || db.access_groups_users || db.AccessGroupsUsers;
    
    if (!this.AccessGroup || !this.Permission || !this.AccessGroupPermission || !this.AccessGroupUser) {
      throw new Error('Required models not found in database instance. Make sure the models are properly defined.');
    }
  }

  /**
   * Create an access group
   * @param {Object} accessGroup - Access group data (name, description)
   * @returns {Promise<Object>} - Created access group
   */
  async createAccessGroup({ name, description }) {
    try {
      if (!name) {
        throw new Error('Access group name is required');
      }

      const accessGroup = await this.AccessGroup.create({
        name,
        description: description || ''
      });

      return accessGroup;
    } catch (error) {
      throw new Error(`Error creating access group: ${error.message}`);
    }
  }

  /**
   * Create a permission
   * @param {Object} permission - Permission data (code, name, description)
   * @returns {Promise<Object>} - Created permission
   */
  async createPermission({ code, name, description }) {
    try {
      if (!code) {
        throw new Error('Permission code is required');
      }

      if (!name) {
        throw new Error('Permission name is required');
      }

      const permission = await this.Permission.create({
        code,
        name,
        description: description || ''
      });

      return permission;
    } catch (error) {
      throw new Error(`Error creating permission: ${error.message}`);
    }
  }

  /**
   * Assign permission to access group
   * @param {number} accessGroupId - Access group ID
   * @param {number} permissionId - Permission ID
   * @returns {Promise<Object>} - Created access group permission
   */
  async assignPermissionToAccessGroup(accessGroupId, permissionId) {
    try {
      if (!accessGroupId) {
        throw new Error('Access group ID is required');
      }

      if (!permissionId) {
        throw new Error('Permission ID is required');
      }

      // Check if access group exists
      const accessGroup = await this.AccessGroup.findByPk(accessGroupId);
      if (!accessGroup) {
        throw new Error(`Access group with ID ${accessGroupId} not found`);
      }

      // Check if permission exists
      const permission = await this.Permission.findByPk(permissionId);
      if (!permission) {
        throw new Error(`Permission with ID ${permissionId} not found`);
      }

      // Check if permission is already assigned to access group
      const existingAssignment = await this.AccessGroupPermission.findOne({
        where: {
          access_group_id: accessGroupId,
          permission_id: permissionId
        }
      });

      if (existingAssignment) {
        return existingAssignment;
      }

      const accessGroupPermission = await this.AccessGroupPermission.create({
        access_group_id: accessGroupId,
        permission_id: permissionId
      });

      return accessGroupPermission;
    } catch (error) {
      throw new Error(`Error assigning permission to access group: ${error.message}`);
    }
  }

  /**
   * Add user to access group
   * @param {number} accessGroupId - Access group ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Created access group user
   */
  async addUserToAccessGroup(accessGroupId, userId) {
    try {
      if (!accessGroupId) {
        throw new Error('Access group ID is required');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Check if access group exists
      const accessGroup = await this.AccessGroup.findByPk(accessGroupId);
      if (!accessGroup) {
        throw new Error(`Access group with ID ${accessGroupId} not found`);
      }

      // Check if user is already in access group
      const existingAssignment = await this.AccessGroupUser.findOne({
        where: {
          access_group_id: accessGroupId,
          user_id: userId
        }
      });

      if (existingAssignment) {
        return existingAssignment;
      }

      const accessGroupUser = await this.AccessGroupUser.create({
        access_group_id: accessGroupId,
        user_id: userId
      });

      return accessGroupUser;
    } catch (error) {
      throw new Error(`Error adding user to access group: ${error.message}`);
    }
  }

  /**
   * Remove user from access group
   * @param {number} accessGroupId - Access group ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - True if user was removed, false otherwise
   */
  async removeUserFromAccessGroup(accessGroupId, userId) {
    try {
      if (!accessGroupId) {
        throw new Error('Access group ID is required');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      const deleted = await this.AccessGroupUser.destroy({
        where: {
          access_group_id: accessGroupId,
          user_id: userId
        }
      });

      return deleted > 0;
    } catch (error) {
      throw new Error(`Error removing user from access group: ${error.message}`);
    }
  }

  /**
   * Get user's access groups
   * @param {number} userId - User ID
   * @returns {Promise<Array>} - Array of access groups
   */
  async getUserAccessGroups(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const { sequelize } = this.db;
      
      const accessGroups = await this.AccessGroup.findAll({
        include: [
          {
            model: this.AccessGroupUser,
            as: 'users',
            where: {
              user_id: userId
            },
            required: true
          }
        ]
      });

      return accessGroups;
    } catch (error) {
      throw new Error(`Error getting user access groups: ${error.message}`);
    }
  }

  /**
   * Get user's permissions
   * @param {number} userId - User ID
   * @returns {Promise<Array>} - Array of permission codes
   */
  async getUserPermissions(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const { sequelize } = this.db;
      
      const permissions = await sequelize.query(`
        SELECT DISTINCT p.code
        FROM permissions p
        JOIN access_group_permissions agp ON p.id = agp.permission_id
        JOIN access_groups_users agu ON agp.access_group_id = agu.access_group_id
        WHERE agu.user_id = :userId
          AND p.deleted_at IS NULL
          AND agp.deleted_at IS NULL
          AND agu.deleted_at IS NULL
      `, {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT
      });

      return permissions.map(permission => permission.code);
    } catch (error) {
      throw new Error(`Error getting user permissions: ${error.message}`);
    }
  }

  /**
   * Get all access groups
   * @returns {Promise<Array>} - Array of access groups
   */
  async getAllAccessGroups() {
    try {
      const accessGroups = await this.AccessGroup.findAll();
      return accessGroups;
    } catch (error) {
      throw new Error(`Error getting access groups: ${error.message}`);
    }
  }

  /**
   * Get all permissions
   * @returns {Promise<Array>} - Array of permissions
   */
  async getAllPermissions() {
    try {
      const permissions = await this.Permission.findAll();
      return permissions;
    } catch (error) {
      throw new Error(`Error getting permissions: ${error.message}`);
    }
  }
}

module.exports = {
  AccessGroupsManager
}; 