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

      // Get the resource type for this permission and resource name
      const resourceType = await this.ResourceLevelPermissionType.findOne({
        where: { 
          permission_id: permission_id,
          name: resource_name 
        }
      });

      if (!resourceType) {
        throw new Error(`Resource type '${resource_name}' is not configured for permission ID ${permission_id}. Please add the resource type requirement first.`);
      }

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

      // Get resource type for this permission and resource name
      const resourceType = await this.ResourceLevelPermissionType.findOne({
        where: { 
          permission_id: permission_id,
          name: resource_name 
        }
      });

      if (!resourceType) {
        throw new Error(`Resource type '${resource_name}' is not configured for permission ID ${permission_id}`);
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

  /**
   * Get resource level permissions for an access group
   * @param {number} access_group_id - Access group ID
   * @param {string} [resource_name] - Optional resource type name to filter by
   * @param {number} [permission_id] - Optional permission ID to filter by
   * @returns {Promise<Object>} - Object with permissions array containing grouped resource access
   */
  async getAccessGroupResourceLevelPermissions(access_group_id, resource_name, permission_id) {
    try {
      // Validate inputs
      if (!access_group_id) {
        throw new Error('Access group ID is required');
      }

      // Build where clause
      const whereClause = {
        access_group_id: access_group_id
      };

      // Add resource type filter if provided
      if (resource_name) {
        const resourceType = await this.ResourceLevelPermissionType.findOne({
          where: { name: resource_name }
        });

        if (!resourceType) {
          throw new Error(`Resource type '${resource_name}' not found`);
        }

        whereClause.resource_type_id = resourceType.id;
      }

      // Add permission filter if provided
      if (permission_id) {
        whereClause.permission_id = permission_id;
      }

      // Get resource level permissions with related data
      const permissions = await this.ResourceLevelPermission.findAll({
        where: whereClause,
        include: [
          {
            model: this.ResourceLevelPermissionType,
            as: 'resource_type',
            attributes: ['id', 'name']
          },
          {
            model: this.Permission,
            as: 'permission',
            attributes: ['id', 'code', 'name']
          }
        ],
        attributes: ['id', 'resource_id', 'created_at', 'updated_at']
      });

      // Group permissions by permission ID and resource type
      const permissionMap = new Map();

      permissions.forEach(perm => {
        const permissionId = perm.permission.id;
        const resourceTypeName = perm.resource_type.name;
        const resourceId = perm.resource_id;

        // Initialize permission entry if it doesn't exist
        if (!permissionMap.has(permissionId)) {
          permissionMap.set(permissionId, {
            id: perm.permission.id,
            code: perm.permission.code,
            name: perm.permission.name,
            resources: {}
          });
        }

        const permissionEntry = permissionMap.get(permissionId);

        // Initialize resource type array if it doesn't exist
        if (!permissionEntry.resources[resourceTypeName]) {
          permissionEntry.resources[resourceTypeName] = [];
        }

        // Add resource ID if not already present
        if (!permissionEntry.resources[resourceTypeName].includes(resourceId)) {
          permissionEntry.resources[resourceTypeName].push(resourceId);
        }
      });

      // Convert map to array and sort resource IDs
      const permissionsArray = Array.from(permissionMap.values()).map(permission => ({
        ...permission,
        resources: Object.keys(permission.resources).reduce((acc, resourceType) => {
          acc[resourceType] = permission.resources[resourceType].sort((a, b) => a - b);
          return acc;
        }, {})
      }));

      // Sort permissions by ID
      permissionsArray.sort((a, b) => a.id - b.id);

      return {
        permissions: permissionsArray
      };
    } catch (error) {
      throw new Error(`Error getting access group resource level permissions: ${error.message}`);
    }
  }

  /**
   * Get resource types that require resource-level access for a given permission
   * @param {number} permission_id - Permission ID
   * @returns {Promise<Array>} - Array of resource type names
   */
  async getResourceTypesForPermission(permission_id) {
    try {
      // Validate input
      if (!permission_id) {
        throw new Error('Permission ID is required');
      }

      // Get resource types for the permission
      const resourceTypes = await this.ResourceLevelPermissionType.findAll({
        where: { permission_id },
        attributes: ['id', 'name'],
        include: [
          {
            model: this.Permission,
            as: 'permission',
            attributes: ['id', 'code', 'name']
          }
        ]
      });

      return resourceTypes.map(rt => rt.name);
    } catch (error) {
      throw new Error(`Error getting resource types for permission: ${error.message}`);
    }
  }

  /**
   * Add resource type requirement for a permission
   * @param {number} permission_id - Permission ID
   * @param {string} resource_name - Resource type name
   * @returns {Promise<Object>} - Created resource level permission type
   */
  async addResourceTypeForPermission(permission_id, resource_name) {
    try {
      // Validate inputs
      if (!permission_id || !resource_name) {
        throw new Error('Permission ID and resource name are required');
      }

      // Check if permission exists
      const permission = await this.Permission.findByPk(permission_id);
      if (!permission) {
        throw new Error(`Permission with ID ${permission_id} not found`);
      }

      // Create or find the resource type requirement
      const [resourceType, created] = await this.ResourceLevelPermissionType.findOrCreate({
        where: {
          permission_id,
          name: resource_name
        },
        defaults: {
          permission_id,
          name: resource_name
        }
      });

      return resourceType;
    } catch (error) {
      throw new Error(`Error adding resource type for permission: ${error.message}`);
    }
  }

  /**
   * Remove resource type requirement for a permission
   * @param {number} permission_id - Permission ID
   * @param {string} resource_name - Resource type name
   * @returns {Promise<boolean>} - True if removed, false if not found
   */
  async removeResourceTypeForPermission(permission_id, resource_name) {
    try {
      // Validate inputs
      if (!permission_id || !resource_name) {
        throw new Error('Permission ID and resource name are required');
      }

      // Remove the resource type requirement
      const deleted = await this.ResourceLevelPermissionType.destroy({
        where: {
          permission_id,
          name: resource_name
        }
      });

      return deleted > 0;
    } catch (error) {
      throw new Error(`Error removing resource type for permission: ${error.message}`);
    }
  }

  /**
   * Get all permissions with their required resource types
   * @param {boolean} [includeWithoutResourceTypes=true] - Whether to include permissions that don't have resource type requirements
   * @returns {Promise<Array>} - Array of permissions with their resource types
   */
  async getAllPermissionsWithResourceTypes(includeWithoutResourceTypes = true) {
    try {
      if (includeWithoutResourceTypes) {
        // Get all permissions and their resource types (if any)
        const permissions = await this.Permission.findAll({
          include: [
            {
              model: this.ResourceLevelPermissionType,
              as: 'resource_types',
              attributes: ['id', 'name'],
              required: false // LEFT JOIN to include permissions without resource types
            }
          ],
          attributes: ['id', 'code', 'name', 'description']
        });

        // Transform the data to group resource types
        return permissions.map(permission => ({
          id: permission.id,
          code: permission.code,
          name: permission.name,
          description: permission.description,
          resource_types: permission.resource_types ? permission.resource_types.map(rt => rt.name) : []
        }));
      } else {
        // Get only permissions that have resource type requirements
        const permissions = await this.Permission.findAll({
          include: [
            {
              model: this.ResourceLevelPermissionType,
              as: 'resource_types',
              attributes: ['id', 'name'],
              required: true // INNER JOIN to include only permissions with resource types
            }
          ],
          attributes: ['id', 'code', 'name', 'description']
        });

        // Transform the data to group resource types
        return permissions.map(permission => ({
          id: permission.id,
          code: permission.code,
          name: permission.name,
          description: permission.description,
          resource_types: permission.resource_types.map(rt => rt.name)
        }));
      }
    } catch (error) {
      throw new Error(`Error getting all permissions with resource types: ${error.message}`);
    }
  }
}

module.exports = { ResourceLevelPermissionsManager }; 