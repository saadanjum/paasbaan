/**
 * Access Groups Manager utility
 * Handles operations related to access groups, permissions, and user assignments
 */

/**
 * Custom error class for duplicate access group names
 */
class DuplicateAccessGroupNameError extends Error {
  constructor(name) {
    super(`Access group with name '${name}' already exists`);
    this.name = 'DuplicateAccessGroupNameError';
    this.code = 'DUPLICATE_ACCESS_GROUP_NAME';
    this.duplicateName = name;
  }
}

/**
 * Custom error class for duplicate permission codes
 */
class DuplicatePermissionCodeError extends Error {
  constructor(code) {
    super(`Permission with code '${code}' already exists`);
    this.name = 'DuplicatePermissionCodeError';
    this.code = 'DUPLICATE_PERMISSION_CODE';
    this.duplicateCode = code;
  }
}

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

      const trimmedName = name.trim();

      // Check if access group with the same name already exists
      const existingAccessGroup = await this.AccessGroup.findOne({
        where: { name: trimmedName }
      });

      if (existingAccessGroup) {
        throw new DuplicateAccessGroupNameError(trimmedName);
      }

      const accessGroup = await this.AccessGroup.create({
        name: trimmedName,
        description: description || ''
      });

      return accessGroup;
    } catch (error) {
      // Re-throw custom errors without wrapping them
      if (error instanceof DuplicateAccessGroupNameError) {
        throw error;
      }
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
          throw new DuplicateAccessGroupNameError(trimmedName);
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
      // Re-throw custom errors without wrapping them
      if (error instanceof DuplicateAccessGroupNameError) {
        throw error;
      }
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

      const trimmedCode = code.trim();

      // Check if permission with the same code already exists
      const existingPermission = await this.Permission.findOne({
        where: { code: trimmedCode }
      });

      if (existingPermission) {
        throw new DuplicatePermissionCodeError(trimmedCode);
      }

      const permission = await this.Permission.create({
        code: trimmedCode,
        name: name.trim(),
        description: description || ''
      });

      return permission;
    } catch (error) {
      // Re-throw custom errors without wrapping them
      if (error instanceof DuplicatePermissionCodeError) {
        throw error;
      }
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
        throw new Error(`Invalid permission ID`);
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

  /**
   * Create access group with users, permissions, and resource-level permissions in a single transaction
   * @param {Object} accessGroupData - Access group data
   * @param {string} accessGroupData.name - Access group name
   * @param {string} [accessGroupData.description] - Access group description
   * @param {Array<number>} accessGroupData.user_ids - Array of user IDs to add to the group
   * @param {Array<Object>} accessGroupData.permissions - Array of permission objects
   * @param {number} accessGroupData.permissions[].permission_id - Permission ID
   * @param {Object} [accessGroupData.permissions[].resource_level_permissions] - Resource-level permissions (optional)
   * @returns {Promise<Object>} - Created access group with assignments
   */
  async createAccessGroupWithAssignments(accessGroupData) {
    const transaction = await this.db.sequelize.transaction();
    
    try {
      const { name, description, user_ids = [], permissions = [] } = accessGroupData;

      if (!name) {
        throw new Error('Access group name is required');
      }

      // Validate input data
      if (!Array.isArray(user_ids)) {
        throw new Error('user_ids must be an array');
      }

      if (!Array.isArray(permissions)) {
        throw new Error('permissions must be an array');
      }

      const trimmedName = name.trim();

      // Check if access group with the same name already exists
      const existingAccessGroup = await this.AccessGroup.findOne({
        where: { name: trimmedName },
        transaction
      });

      if (existingAccessGroup) {
        throw new DuplicateAccessGroupNameError(trimmedName);
      }

      // Step 1: Create the access group
      const accessGroup = await this.AccessGroup.create({
        name: trimmedName,
        description: description || ''
      }, { transaction });

      // Step 2: Add users to the access group
      const userAssignments = [];
      for (const userId of user_ids) {
        // Check if user exists (optional validation)
        if (this.db.User) {
          const userExists = await this.db.User.findByPk(userId, { transaction });
          if (!userExists) {
            throw new Error(`User not found for access group assignment`);
          }
        }

        // Check if user is already in access group (should not happen in creation, but safety check)
        const existingUserAssignment = await this.AccessGroupUser.findOne({
          where: {
            access_group_id: accessGroup.id,
            user_id: userId
          },
          transaction
        });

        if (!existingUserAssignment) {
          const assignment = await this.AccessGroupUser.create({
            access_group_id: accessGroup.id,
            user_id: userId
          }, { transaction });
          userAssignments.push(assignment);
        }
      }

      // Step 3: Add permissions and resource-level permissions
      const permissionAssignments = [];
      const resourceLevelPermissions = [];

      for (const permissionData of permissions) {
        const { permission_id, resource_level_permissions = {} } = permissionData;

        if (!permission_id) {
          throw new Error('permission_id is required for each permission');
        }

        // Validate permission exists
        const permission = await this.Permission.findByPk(permission_id, { transaction });
        if (!permission) {
          throw new Error(`Invalid permission ID`);
        }

        // Check if permission is already assigned to access group
        const existingPermissionAssignment = await this.AccessGroupPermission.findOne({
          where: {
            access_group_id: accessGroup.id,
            permission_id: permission_id
          },
          transaction
        });

        if (!existingPermissionAssignment) {
          const assignment = await this.AccessGroupPermission.create({
            access_group_id: accessGroup.id,
            permission_id: permission_id
          }, { transaction });
          permissionAssignments.push(assignment);
        }

        // Handle resource-level permissions if provided and models exist
        if (this.db.ResourceLevelPermission && this.db.ResourceLevelPermissionType && 
            Object.keys(resource_level_permissions).length > 0) {
          
          for (const [resource_name, resource_ids] of Object.entries(resource_level_permissions)) {
            if (!Array.isArray(resource_ids)) {
              throw new Error(`Resource IDs for ${resource_name} must be an array`);
            }

            // Get or create resource type
            let resourceType = await this.db.ResourceLevelPermissionType.findOne({
              where: {
                permission_id: permission_id,
                name: resource_name
              },
              transaction
            });

            if (!resourceType) {
              resourceType = await this.db.ResourceLevelPermissionType.create({
                permission_id: permission_id,
                name: resource_name
              }, { transaction });
            }

            // Create resource-level permissions
            for (const resource_id of resource_ids) {
              // Check if resource-level permission already exists
              const existingResourcePermission = await this.db.ResourceLevelPermission.findOne({
                where: {
                  permission_id: permission_id,
                  resource_id: resource_id,
                  resource_type_id: resourceType.id,
                  access_group_id: accessGroup.id
                },
                transaction
              });

              if (!existingResourcePermission) {
                const resourcePermission = await this.db.ResourceLevelPermission.create({
                  permission_id: permission_id,
                  resource_id: resource_id,
                  resource_type_id: resourceType.id,
                  access_group_id: accessGroup.id
                }, { transaction });
                resourceLevelPermissions.push(resourcePermission);
              }
            }
          }
        }
      }

      // Commit the transaction
      await transaction.commit();

      // Return the created access group with assignment details
      return {
        access_group: accessGroup,
        user_assignments: userAssignments,
        permission_assignments: permissionAssignments,
        resource_level_permissions: resourceLevelPermissions,
        summary: {
          users_added: userAssignments.length,
          permissions_added: permissionAssignments.length,
          resource_permissions_added: resourceLevelPermissions.length
        }
      };

    } catch (error) {
      // Rollback the transaction on error
      await transaction.rollback();
      
      // Re-throw custom errors without wrapping them
      if (error instanceof DuplicateAccessGroupNameError) {
        throw error;
      }
      throw new Error(`Error creating access group with assignments: ${error.message}`);
    }
  }

  /**
   * Update access group with users, permissions, and resource-level permissions in a single transaction
   * @param {number} accessGroupId - Access group ID to update
   * @param {Object} updateData - Update data
   * @param {string} [updateData.name] - New access group name
   * @param {string} [updateData.description] - New access group description
   * @param {Array<number>} [updateData.user_ids] - Array of user IDs (replaces existing users)
   * @param {Array<Object>} [updateData.permissions] - Array of permission objects (replaces existing permissions)
   * @param {number} updateData.permissions[].permission_id - Permission ID
   * @param {Object} [updateData.permissions[].resource_level_permissions] - Resource-level permissions (optional)
   * @param {boolean} [updateData.replace_assignments=true] - Whether to replace existing assignments or add to them
   * @returns {Promise<Object>} - Updated access group with assignments
   */
  async updateAccessGroupWithAssignments(accessGroupId, updateData) {
    const transaction = await this.db.sequelize.transaction();
    
    try {
      if (!accessGroupId) {
        throw new Error('Access group ID is required');
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        throw new Error('Update data is required');
      }

      const { name, description, user_ids, permissions, replace_assignments = true } = updateData;

      // Check if access group exists
      const accessGroup = await this.AccessGroup.findByPk(accessGroupId, { transaction });
      if (!accessGroup) {
        throw new Error(`Access group with ID ${accessGroupId} not found`);
      }

      // Step 1: Update access group basic info if provided
      const groupUpdateData = {};
      if (name !== undefined) {
        const trimmedName = name.trim();
        
        // Check if another access group with the same name exists (excluding current group)
        const existingAccessGroup = await this.AccessGroup.findOne({
          where: { 
            name: trimmedName,
            id: { [this.db.Sequelize.Op.ne]: accessGroupId }
          },
          transaction
        });

        if (existingAccessGroup) {
          throw new DuplicateAccessGroupNameError(trimmedName);
        }

        groupUpdateData.name = trimmedName;
      }

      if (description !== undefined) {
        groupUpdateData.description = description;
      }

      if (Object.keys(groupUpdateData).length > 0) {
        await this.AccessGroup.update(groupUpdateData, {
          where: { id: accessGroupId },
          transaction
        });
      }

      let userAssignments = [];
      let permissionAssignments = [];
      let resourceLevelPermissions = [];

      // Step 2: Handle user assignments if provided
      if (user_ids !== undefined) {
        if (!Array.isArray(user_ids)) {
          throw new Error('user_ids must be an array');
        }

        if (replace_assignments) {
          // Remove existing user assignments
          await this.AccessGroupUser.destroy({
            where: { access_group_id: accessGroupId },
            transaction
          });
        }

        // Add new users
        for (const userId of user_ids) {
          // Check if user exists (optional validation)
          if (this.db.User) {
            const userExists = await this.db.User.findByPk(userId, { transaction });
            if (!userExists) {
              throw new Error(`User not found for access group assignment`);
            }
          }

          // Check if user is already in access group
          const existingUserAssignment = await this.AccessGroupUser.findOne({
            where: {
              access_group_id: accessGroupId,
              user_id: userId
            },
            transaction
          });

          if (!existingUserAssignment) {
            const assignment = await this.AccessGroupUser.create({
              access_group_id: accessGroupId,
              user_id: userId
            }, { transaction });
            userAssignments.push(assignment);
          }
        }
      }

      // Step 3: Handle permission assignments if provided
      if (permissions !== undefined) {
        if (!Array.isArray(permissions)) {
          throw new Error('permissions must be an array');
        }

        if (replace_assignments) {
          // Remove existing resource-level permissions first
          if (this.db.ResourceLevelPermission) {
            await this.db.ResourceLevelPermission.destroy({
              where: { access_group_id: accessGroupId },
              transaction
            });
          }

          // Remove existing permission assignments
          await this.AccessGroupPermission.destroy({
            where: { access_group_id: accessGroupId },
            transaction
          });
        }

        // Add new permissions and resource-level permissions
        for (const permissionData of permissions) {
          const { permission_id, resource_level_permissions = {} } = permissionData;

          if (!permission_id) {
            throw new Error('permission_id is required for each permission');
          }

          // Validate permission exists
          const permission = await this.Permission.findByPk(permission_id, { transaction });
          if (!permission) {
            throw new Error(`Invalid permission ID`);
          }

          // Check if permission is already assigned to access group
          const existingPermissionAssignment = await this.AccessGroupPermission.findOne({
            where: {
              access_group_id: accessGroupId,
              permission_id: permission_id
            },
            transaction
          });

          if (!existingPermissionAssignment) {
            const assignment = await this.AccessGroupPermission.create({
              access_group_id: accessGroupId,
              permission_id: permission_id
            }, { transaction });
            permissionAssignments.push(assignment);
          }

          // Handle resource-level permissions if provided and models exist
          if (this.db.ResourceLevelPermission && this.db.ResourceLevelPermissionType && 
              Object.keys(resource_level_permissions).length > 0) {
            
            for (const [resource_name, resource_ids] of Object.entries(resource_level_permissions)) {
              if (!Array.isArray(resource_ids)) {
                throw new Error(`Resource IDs for ${resource_name} must be an array`);
              }

              // Get or create resource type
              let resourceType = await this.db.ResourceLevelPermissionType.findOne({
                where: {
                  permission_id: permission_id,
                  name: resource_name
                },
                transaction
              });

              if (!resourceType) {
                resourceType = await this.db.ResourceLevelPermissionType.create({
                  permission_id: permission_id,
                  name: resource_name
                }, { transaction });
              }

              // Create resource-level permissions
              for (const resource_id of resource_ids) {
                // Check if resource-level permission already exists
                const existingResourcePermission = await this.db.ResourceLevelPermission.findOne({
                  where: {
                    permission_id: permission_id,
                    resource_id: resource_id,
                    resource_type_id: resourceType.id,
                    access_group_id: accessGroupId
                  },
                  transaction
                });

                if (!existingResourcePermission) {
                  const resourcePermission = await this.db.ResourceLevelPermission.create({
                    permission_id: permission_id,
                    resource_id: resource_id,
                    resource_type_id: resourceType.id,
                    access_group_id: accessGroupId
                  }, { transaction });
                  resourceLevelPermissions.push(resourcePermission);
                }
              }
            }
          }
        }
      }

      // Commit the transaction
      await transaction.commit();

      // Get updated access group
      const updatedAccessGroup = await this.AccessGroup.findByPk(accessGroupId);

      // Return the updated access group with assignment details
      return {
        access_group: updatedAccessGroup,
        user_assignments: userAssignments,
        permission_assignments: permissionAssignments,
        resource_level_permissions: resourceLevelPermissions,
        summary: {
          users_processed: user_ids ? user_ids.length : 0,
          permissions_processed: permissions ? permissions.length : 0,
          users_added: userAssignments.length,
          permissions_added: permissionAssignments.length,
          resource_permissions_added: resourceLevelPermissions.length
        }
      };

    } catch (error) {
      // Rollback the transaction on error
      await transaction.rollback();
      
      // Re-throw custom errors without wrapping them
      if (error instanceof DuplicateAccessGroupNameError) {
        throw error;
      }
      throw new Error(`Error updating access group with assignments: ${error.message}`);
    }
  }
}

module.exports = {
  AccessGroupsManager,
  DuplicateAccessGroupNameError,
  DuplicatePermissionCodeError
}; 