/**
 * Resource Level Permissions Manager utility
 * Handles operations related to resource level permissions
 */

class ResourceLevelPermissionsManager {
  /**
   * @constructor
   * @param {Object} db - Sequelize database instance
   */
  constructor(db) {
    if (!db) {
      throw new Error('Database instance is required');
    }

    this.db = db;
    this.ResourceLevelPermissionType = db.ResourceLevelPermissionType;
    this.ResourceLevelPermission = db.ResourceLevelPermission;
    this.AccessGroup = db.AccessGroup;
    this.Permission = db.Permission;
    this.AccessGroupUser = db.AccessGroupUser;
  }

  /**
   * Add resource level permission
   * @param {number} permission_id - Permission ID
   * @param {Array<number>} resource_ids - Array of resource IDs
   * @param {string} resource_name - Resource type name
   * @param {number} access_group_id - Access group ID
   * @returns {Promise<Array>} - Array of created resource level permissions
   */
  async addResourceLevelPermission(permission_id, resource_ids, resource_name, access_group_id) {
    try {
      // Validate inputs
      if (!permission_id || !resource_ids || !resource_name || !access_group_id) {
        throw new Error('All parameters are required');
      }

      if (!Array.isArray(resource_ids) || resource_ids.length === 0) {
        throw new Error('resource_ids must be a non-empty array');
      }

      // Get or create resource type
      const [resourceType] = await this.ResourceLevelPermissionType.findOrCreate({
        where: { name: resource_name },
        defaults: { name: resource_name }
      });

      // Create resource level permissions
      const permissions = await Promise.all(
        resource_ids.map(resource_id =>
          this.ResourceLevelPermission.findOrCreate({
            where: {
              permission_id,
              resource_id,
              resource_type_id: resourceType.id,
              access_group_id
            },
            defaults: {
              permission_id,
              resource_id,
              resource_type_id: resourceType.id,
              access_group_id
            }
          })
        )
      );

      return permissions.map(([permission]) => permission);
    } catch (error) {
      throw new Error(`Error adding resource level permission: ${error.message}`);
    }
  }

  /**
   * Remove resource level permission
   * @param {number} permission_id - Permission ID
   * @param {Array<number>} resource_ids - Array of resource IDs
   * @param {string} resource_name - Resource type name
   * @param {number} access_group_id - Access group ID
   * @returns {Promise<number>} - Number of deleted permissions
   */
  async removeResourceLevelPermission(permission_id, resource_ids, resource_name, access_group_id) {
    try {
      // Validate inputs
      if (!permission_id || !resource_ids || !resource_name || !access_group_id) {
        throw new Error('All parameters are required');
      }

      if (!Array.isArray(resource_ids) || resource_ids.length === 0) {
        throw new Error('resource_ids must be a non-empty array');
      }

      // Get resource type
      const resourceType = await this.ResourceLevelPermissionType.findOne({
        where: { name: resource_name }
      });

      if (!resourceType) {
        throw new Error(`Resource type '${resource_name}' not found`);
      }

      // Delete resource level permissions
      const deleted = await this.ResourceLevelPermission.destroy({
        where: {
          permission_id,
          resource_id: resource_ids,
          resource_type_id: resourceType.id,
          access_group_id
        }
      });

      return deleted;
    } catch (error) {
      throw new Error(`Error removing resource level permission: ${error.message}`);
    }
  }

  /**
   * Get resource level permissions for a user
   * @param {string} resource_name - Resource type name
   * @param {number} permission_id - Permission ID to check for
   * @param {number} user_id - User ID
   * @returns {Promise<Array>} - Array of resource IDs the user has access to
   */
  async getResourceLevelPermissions(resource_name, permission_id, user_id) {
    try {
      // Validate inputs
      if (!resource_name || !permission_id || !user_id) {
        throw new Error('Resource name, permission ID, and user ID are required');
      }

      // Get resource type
      const resourceType = await this.ResourceLevelPermissionType.findOne({
        where: { name: resource_name }
      });

      if (!resourceType) {
        throw new Error(`Resource type '${resource_name}' not found`);
      }

      // Get user's access groups
      const userAccessGroups = await this.AccessGroupUser.findAll({
        where: { user_id },
        attributes: ['access_group_id']
      });

      const accessGroupIds = userAccessGroups.map(ag => ag.access_group_id);

      if (accessGroupIds.length === 0) {
        return [];
      }

      // Get resource level permissions for user's access groups and specific permission
      const permissions = await this.ResourceLevelPermission.findAll({
        where: {
          resource_type_id: resourceType.id,
          permission_id: permission_id,
          access_group_id: accessGroupIds
        },
        attributes: ['resource_id']
      });

      return [...new Set(permissions.map(p => p.resource_id))];
    } catch (error) {
      throw new Error(`Error getting resource level permissions: ${error.message}`);
    }
  }

  /**
   * Check if user has permission to access resources
   * @param {string} resource_name - Resource type name
   * @param {number} permission_id - Permission ID to check for
   * @param {Array<number>} resource_ids - Array of resource IDs to check
   * @param {number} user_id - User ID
   * @returns {Promise<boolean>} - True if user has access to all resources with the specified permission
   */
  async hasResourceAccess(resource_name, permission_id, resource_ids, user_id) {
    try {
      // Validate inputs
      if (!resource_name || !permission_id || !resource_ids || !user_id) {
        throw new Error('All parameters are required');
      }

      if (!Array.isArray(resource_ids) || resource_ids.length === 0) {
        throw new Error('resource_ids must be a non-empty array');
      }

      // Get user's accessible resources for the specific permission
      const accessibleResources = await this.getResourceLevelPermissions(resource_name, permission_id, user_id);

      // Check if user has access to all requested resources with the specified permission
      return resource_ids.every(id => accessibleResources.includes(id));
    } catch (error) {
      throw new Error(`Error checking resource access: ${error.message}`);
    }
  }
}

module.exports = { ResourceLevelPermissionsManager }; 