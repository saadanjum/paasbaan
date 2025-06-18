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

      // Check if access group with the same name already exists
      const existingAccessGroup = await this.AccessGroup.findOne({
        where: { name: name.trim() }
      });

      if (existingAccessGroup) {
        throw new Error(`Access group with name '${name.trim()}' already exists`);
      }

      const accessGroup = await this.AccessGroup.create({
        name: name.trim(),
        description: description || ''
      });

      return accessGroup;
    } catch (error) {
      throw new Error(`Error creating access group: ${error.message}`);
    }
  }

  /**
   * Update an access group
   * @param {number} accessGroupId - Access group ID
   * @param {Object} updateData - Data to update (name, description)
   * @returns {Promise<Object>} - Updated access group
   */
  async updateAccessGroup(accessGroupId, updateData) {
    try {
      if (!accessGroupId) {
        throw new Error('Access group ID is required');
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        throw new Error('Update data is required');
      }

      // Check if access group exists
      const accessGroup = await this.AccessGroup.findByPk(accessGroupId);
      if (!accessGroup) {
        throw new Error(`Access group with ID ${accessGroupId} not found`);
      }

      // Validate update data
      const allowedFields = ['name', 'description'];
      const filteredUpdateData = {};
      
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredUpdateData[key] = updateData[key];
        }
      });

      if (Object.keys(filteredUpdateData).length === 0) {
        throw new Error('No valid fields to update. Allowed fields: name, description');
      }

      // If name is being updated, check for uniqueness
      if (filteredUpdateData.name) {
        const trimmedName = filteredUpdateData.name.trim();
        
        // Check if another access group with the same name exists (excluding current group)
        const existingAccessGroup = await this.AccessGroup.findOne({
          where: { 
            name: trimmedName,
            id: { [this.db.Sequelize.Op.ne]: accessGroupId }
          }
        });

        if (existingAccessGroup) {
          throw new Error(`Access group with name '${trimmedName}' already exists`);
        }

        filteredUpdateData.name = trimmedName;
      }

      // Update the access group
      const [affectedRows] = await this.AccessGroup.update(filteredUpdateData, {
        where: { id: accessGroupId },
        returning: true
      });

      if (affectedRows === 0) {
        throw new Error('Failed to update access group');
      }

      // Return updated access group
      const updatedAccessGroup = await this.AccessGroup.findByPk(accessGroupId);
      return updatedAccessGroup;
    } catch (error) {
      throw new Error(`Error updating access group: ${error.message}`);
    }
  }

  /**
   * Delete an access group (soft delete)
   * @param {number} accessGroupId - Access group ID
   * @param {boolean} [force=false] - Whether to force delete (hard delete)
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteAccessGroup(accessGroupId, force = false) {
    try {
      if (!accessGroupId) {
        throw new Error('Access group ID is required');
      }

      // Check if access group exists
      const accessGroup = await this.AccessGroup.findByPk(accessGroupId);
      if (!accessGroup) {
        throw new Error(`Access group with ID ${accessGroupId} not found`);
      }

      // Check if access group has users
      const usersCount = await this.AccessGroupUser.count({
        where: { access_group_id: accessGroupId }
      });

      if (usersCount > 0) {
        throw new Error(`Cannot delete access group: ${usersCount} users are still assigned to this group. Remove all users first.`);
      }

      // Check if access group has permissions
      const permissionsCount = await this.AccessGroupPermission.count({
        where: { access_group_id: accessGroupId }
      });

      if (permissionsCount > 0) {
        throw new Error(`Cannot delete access group: ${permissionsCount} permissions are still assigned to this group. Remove all permissions first.`);
      }

      // Check if access group has resource level permissions
      if (this.db.ResourceLevelPermission) {
        const resourcePermissionsCount = await this.db.ResourceLevelPermission.count({
          where: { access_group_id: accessGroupId }
        });

        if (resourcePermissionsCount > 0) {
          throw new Error(`Cannot delete access group: ${resourcePermissionsCount} resource-level permissions are still assigned to this group. Remove all resource permissions first.`);
        }
      }

      // Delete the access group
      const deleted = await this.AccessGroup.destroy({
        where: { id: accessGroupId },
        force: force
      });

      return deleted > 0;
    } catch (error) {
      throw new Error(`Error deleting access group: ${error.message}`);
    }
  }

  /**
   * Get access group by ID
   * @param {number} accessGroupId - Access group ID
   * @returns {Promise<Object|null>} - Access group or null if not found
   */
  async getAccessGroupById(accessGroupId) {
    try {
      if (!accessGroupId) {
        throw new Error('Access group ID is required');
      }

      const accessGroup = await this.AccessGroup.findByPk(accessGroupId);
      return accessGroup;
    } catch (error) {
      throw new Error(`Error getting access group: ${error.message}`);
    }
  }

  /**
   * Remove permission from access group
   * @param {number} accessGroupId - Access group ID
   * @param {number} permissionId - Permission ID
   * @returns {Promise<boolean>} - True if permission was removed, false otherwise
   */
  async removePermissionFromAccessGroup(accessGroupId, permissionId) {
    try {
      if (!accessGroupId) {
        throw new Error('Access group ID is required');
      }

      if (!permissionId) {
        throw new Error('Permission ID is required');
      }

      const deleted = await this.AccessGroupPermission.destroy({
        where: {
          access_group_id: accessGroupId,
          permission_id: permissionId
        }
      });

      return deleted > 0;
    } catch (error) {
      throw new Error(`Error removing permission from access group: ${error.message}`);
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

  /**
   * Get all users in an access group
   * @param {number} accessGroupId - Access group ID
   * @returns {Promise<Array>} - Array of users
   */
  async getUsersInAccessGroup(accessGroupId) {
    try {
      if (!accessGroupId) {
        throw new Error('Access group ID is required');
      }

      const users = await this.db.User.findAll({
        include: [{
          model: this.AccessGroup,
          as: 'access_groups',
          where: {
            id: accessGroupId
          },
          // through: {
          //   model: this.AccessGroupUser
          // },
          required: true
        }]
      });

      return users;
    } catch (error) {
      throw new Error(`Error getting users in access group: ${error.message}`);
    }
  }
}

module.exports = {
  AccessGroupsManager
}; 