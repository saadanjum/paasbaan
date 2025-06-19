/**
 * @fileoverview Main entry point for the Access Control module.
 */

const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const { validateTables, setupInitialData } = require('./src/utils/dbValidation');
const authMiddleware = require('./src/middleware/authMiddleware');
const { AccessGroupsManager, DuplicateAccessGroupNameError, DuplicatePermissionCodeError } = require('./src/utils/accessGroupsManager');
const { ResourceLevelPermissionsManager } = require('./src/utils/resourceLevelPermissionsManager');

class AccessControl {
  /**
   * @constructor
   * @param {Object} config - Configuration options
   * @param {Object} config.db - Sequelize database instance
   * @param {Object} config.route_access - Route access configuration
   * @param {string|boolean} [config.cache='false'] - Cache type, either 'in-memory' or false
   * @param {Object} [config.cache_config={}] - Cache configuration
   * @param {string} [config.userIdKey='userId'] - User ID key in JWT token
   * @param {string|boolean} [config.logging=false] - Logging type, either 'console' or false
   */
  constructor(config) {
    if (!config) {
      throw new Error('Configuration is required');
    }

    if (!config.db) {
      throw new Error('Database instance is required');
    }

    if (!config.route_access) {
      throw new Error('Route access configuration is required');
    }

    this.db = config.db;
    this.route_access = config.route_access;
    this.userIdKey = config.userIdKey || 'userId';
    this.logging = config.logging || false;
    this.resourceLevelPermissions = config.resourceLevelPermissions || false;
    
    // Initialize cache if enabled
    this.cache = config.cache || false;
    if (this.cache === 'in-memory') {
      this.cacheEngine = new NodeCache(config.cache_config || {});
    }

    // Initialize managers
    this.accessGroupsManager = new AccessGroupsManager(this.db);
    this.resourceLevelPermissionsManager = new ResourceLevelPermissionsManager(this.db);

    // Validate database tables and setup initial data
    this.validateAndSetupDb();
  }

  /**
   * Validate required database tables and setup initial data
   */
  async validateAndSetupDb() {
    try {

      const requiredTables = [
        'access_groups',
        'access_group_permissions',
        'permissions',
        'access_groups_users'
      ];
      
      if (this.resourceLevelPermissions) {
        requiredTables.push('resource_level_permissions');
        requiredTables.push('resource_level_permissions_types');
      }

      await validateTables(this.db, requiredTables);
      await setupInitialData(this.db);
      
      if (this.logging === 'console') {
        console.log('[AccessControl] Database tables validated successfully');
        console.log('[AccessControl] Initial data setup completed');
      }
    } catch (error) {
      throw new Error(`Failed to validate database tables: ${error.message}`);
    }
  }

  /**
   * Get authorization middleware
   * @returns {Function} Express middleware function
   */
  getAuthMiddleware() {
    return authMiddleware({
      db: this.db,
      route_access: this.route_access,
      userIdKey: this.userIdKey,
      cache: this.cache === 'in-memory' ? this.cacheEngine : false,
      logging: this.logging
    });
  }

  /**
   * Get user permissions
   * @param {string|number} userId - User ID
   * @returns {Promise<Array>} - Array of permission codes
   */
  async getUserPermissions(userId) {
    try {
      // Check cache first if enabled
      if (this.cache === 'in-memory') {
        const cacheKey = `user_permissions_${userId}`;
        const cachedPermissions = this.cacheEngine.get(cacheKey);
        
        if (cachedPermissions) {
          return cachedPermissions;
        }
      }

      // Fetch permissions from database
      const permissions = await this.accessGroupsManager.getUserPermissions(userId);

      // Set cache if enabled
      if (this.cache === 'in-memory') {
        const cacheKey = `user_permissions_${userId}`;
        this.cacheEngine.set(cacheKey, permissions);
      }

      return permissions;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error getting user permissions:', error);
      }
      throw error;
    }
  }

  /**
   * Check if user has permission
   * @param {string|number} userId - User ID
   * @param {string|Array} permissions - Permission code(s) to check
   * @returns {Promise<boolean>} - True if user has any of the permissions
   */
  async hasPermission(userId, permissions) {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      
      // Check if user has super_admin permission
      if (userPermissions.includes('super_admin')) {
        return true;
      }

      // Convert single permission to array
      const permissionsArray = Array.isArray(permissions) ? permissions : [permissions];

      // Check if user has any of the required permissions
      return permissionsArray.some(permission => userPermissions.includes(permission));
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error checking user permission:', error);
      }
      return false;
    }
  }

  /**
   * Create an access group
   * @param {Object} accessGroup - Access group data
   * @returns {Promise<Object>} - Created access group
   */
  async createAccessGroup(accessGroup) {
    return this.accessGroupsManager.createAccessGroup(accessGroup);
  }

  /**
   * Create a permission
   * @param {Object} permission - Permission data
   * @returns {Promise<Object>} - Created permission
   */
  async createPermission(permission) {
    return this.accessGroupsManager.createPermission(permission);
  }

  /**
   * Assign permission to access group
   * @param {number} accessGroupId - Access group ID
   * @param {number} permissionId - Permission ID
   * @returns {Promise<Object>} - Created access group permission
   */
  async assignPermissionToAccessGroup(accessGroupId, permissionId) {
    return this.accessGroupsManager.assignPermissionToAccessGroup(accessGroupId, permissionId);
  }

  /**
   * Add user to access group
   * @param {number} accessGroupId - Access group ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Created access group user
   */
  async addUserToAccessGroup(accessGroupId, userId) {
    return this.accessGroupsManager.addUserToAccessGroup(accessGroupId, userId);
  }

  /**
   * Remove user from access group
   * @param {number} accessGroupId - Access group ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - True if user was removed, false otherwise
   */
  async removeUserFromAccessGroup(accessGroupId, userId) {
    return this.accessGroupsManager.removeUserFromAccessGroup(accessGroupId, userId);
  }

  /**
   * Update an access group
   * @param {number} accessGroupId - Access group ID
   * @param {Object} updateData - Data to update (name, description)
   * @returns {Promise<Object>} - Updated access group
   */
  async updateAccessGroup(accessGroupId, updateData) {
    try {
      const updatedAccessGroup = await this.accessGroupsManager.updateAccessGroup(accessGroupId, updateData);

      if (this.logging === 'console') {
        console.log(`[AccessControl] Updated access group ${accessGroupId}`);
      }

      // Clear cache for users in this access group if name was changed
      if (updateData.name && this.cache === 'in-memory') {
        const users = await this.accessGroupsManager.getUsersInAccessGroup(accessGroupId);
        users.forEach(user => this.clearUserCache(user.id));
      }

      return updatedAccessGroup;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error updating access group:', error);
      }
      throw error;
    }
  }

  /**
   * Delete an access group
   * @param {number} accessGroupId - Access group ID
   * @param {boolean} [force=false] - Whether to force delete (hard delete)
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteAccessGroup(accessGroupId, force = false) {
    try {
      // Clear cache for users in this access group before deletion
      if (this.cache === 'in-memory') {
        const users = await this.accessGroupsManager.getUsersInAccessGroup(accessGroupId);
        users.forEach(user => this.clearUserCache(user.id));
      }

      const deleted = await this.accessGroupsManager.deleteAccessGroup(accessGroupId, force);

      if (this.logging === 'console') {
        console.log(`[AccessControl] ${deleted ? 'Deleted' : 'Failed to delete'} access group ${accessGroupId}`);
      }

      return deleted;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error deleting access group:', error);
      }
      throw error;
    }
  }

  /**
   * Get access group by ID
   * @param {number} accessGroupId - Access group ID
   * @returns {Promise<Object|null>} - Access group or null if not found
   */
  async getAccessGroupById(accessGroupId) {
    try {
      const accessGroup = await this.accessGroupsManager.getAccessGroupById(accessGroupId);

      if (this.logging === 'console') {
        console.log(`[AccessControl] Retrieved access group ${accessGroupId}`);
      }

      return accessGroup;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error getting access group:', error);
      }
      throw error;
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
      const removed = await this.accessGroupsManager.removePermissionFromAccessGroup(accessGroupId, permissionId);

      if (this.logging === 'console') {
        console.log(`[AccessControl] ${removed ? 'Removed' : 'Failed to remove'} permission ${permissionId} from access group ${accessGroupId}`);
      }

      // Clear cache for users in this access group
      if (this.cache === 'in-memory') {
        const users = await this.accessGroupsManager.getUsersInAccessGroup(accessGroupId);
        users.forEach(user => this.clearUserCache(user.id));
      }

      return removed;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error removing permission from access group:', error);
      }
      throw error;
    }
  }

  /**
   * Clear user permissions cache
   * @param {string|number} userId - User ID
   */
  clearUserCache(userId) {
    if (this.cache === 'in-memory') {
      const cacheKey = `user_permissions_${userId}`;
      this.cacheEngine.del(cacheKey);
      
      if (this.logging === 'console') {
        console.log(`[AccessControl] Cache cleared for user ${userId}`);
      }
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
    try {
      const result = await this.accessGroupsManager.createAccessGroupWithAssignments(accessGroupData);

      if (this.logging === 'console') {
        console.log(`[AccessControl] Created access group '${result.access_group.name}' with ${result.summary.users_added} users, ${result.summary.permissions_added} permissions, and ${result.summary.resource_permissions_added} resource permissions`);
      }

      // Clear cache for all affected users
      if (this.cache === 'in-memory' && accessGroupData.user_ids) {
        accessGroupData.user_ids.forEach(userId => this.clearUserCache(userId));
      }

      return result;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error creating access group with assignments:', error);
      }
      throw error;
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
    try {
      // Get existing users before update to clear their cache
      const existingUsers = this.cache === 'in-memory' ? await this.accessGroupsManager.getUsersInAccessGroup(accessGroupId) : [];

      const result = await this.accessGroupsManager.updateAccessGroupWithAssignments(accessGroupId, updateData);

      if (this.logging === 'console') {
        console.log(`[AccessControl] Updated access group ${accessGroupId} with ${result.summary.users_added} new users, ${result.summary.permissions_added} new permissions, and ${result.summary.resource_permissions_added} resource permissions`);
      }

      // Clear cache for affected users
      if (this.cache === 'in-memory') {
        // Clear cache for previously assigned users
        existingUsers.forEach(user => this.clearUserCache(user.id));
        
        // Clear cache for newly assigned users
        if (updateData.user_ids) {
          updateData.user_ids.forEach(userId => this.clearUserCache(userId));
        }
      }

      return result;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error updating access group with assignments:', error);
      }
      throw error;
    }
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
      const permissions = await this.resourceLevelPermissionsManager.addResourceLevelPermission(
        permission_id,
        resource_ids,
        resource_name,
        access_group_id
      );

      if (this.logging === 'console') {
        console.log(`[AccessControl] Added resource level permissions for ${resource_name}`);
      }

      // Clear cache for affected users
      if (this.cache === 'in-memory') {
        const users = await this.accessGroupsManager.getUsersInAccessGroup(access_group_id);
        users.forEach(user => this.clearUserCache(user.id));
      }

      return permissions;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error adding resource level permission:', error);
      }
      throw error;
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
      const deleted = await this.resourceLevelPermissionsManager.removeResourceLevelPermission(
        permission_id,
        resource_ids,
        resource_name,
        access_group_id
      );

      if (this.logging === 'console') {
        console.log(`[AccessControl] Removed ${deleted} resource level permissions for ${resource_name}`);
      }

      // Clear cache for affected users
      if (this.cache === 'in-memory') {
        const users = await this.accessGroupsManager.getUsersInAccessGroup(access_group_id);
        users.forEach(user => this.clearUserCache(user.id));
      }

      return deleted;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error removing resource level permission:', error);
      }
      throw error;
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
      // Check cache first if enabled
      if (this.cache === 'in-memory') {
        const cacheKey = `resource_permissions_${user_id}_${resource_name}_${permission_id}`;
        const cachedPermissions = this.cacheEngine.get(cacheKey);
        
        if (cachedPermissions) {
          return cachedPermissions;
        }
      }

      const permissions = await this.resourceLevelPermissionsManager.getResourceLevelPermissions(
        resource_name,
        permission_id,
        user_id
      );

      // Set cache if enabled
      if (this.cache === 'in-memory') {
        const cacheKey = `resource_permissions_${user_id}_${resource_name}_${permission_id}`;
        this.cacheEngine.set(cacheKey, permissions);
      }

      return permissions;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error getting resource level permissions:', error);
      }
      throw error;
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
      return await this.resourceLevelPermissionsManager.hasResourceAccess(
        resource_name,
        permission_id,
        resource_ids,
        user_id
      );
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error checking resource access:', error);
      }
      throw error;
    }
  }

  /**
   * Clear user's resource permissions cache
   * @param {number} user_id - User ID
   * @param {string} [resource_name] - Optional resource type name to clear specific cache
   * @param {number} [permission_id] - Optional permission ID to clear specific cache
   */
  clearResourcePermissionsCache(user_id, resource_name, permission_id) {
    if (this.cache === 'in-memory') {
      if (resource_name && permission_id) {
        const cacheKey = `resource_permissions_${user_id}_${resource_name}_${permission_id}`;
        this.cacheEngine.del(cacheKey);
      } else {
        // Clear all resource permissions cache for user
        const keys = this.cacheEngine.keys();
        const userKeys = keys.filter(key => key.startsWith(`resource_permissions_${user_id}_`));
        userKeys.forEach(key => this.cacheEngine.del(key));
      }
      
      if (this.logging === 'console') {
        console.log(`[AccessControl] Cleared resource permissions cache for user ${user_id}`);
      }
    }
  }

  /**
   * Get resource level permissions for an access group
   * @param {number} access_group_id - Access group ID
   * @param {string} [resource_name] - Optional resource type name to filter by
   * @param {number} [permission_id] - Optional permission ID to filter by
   * @returns {Promise<Array>} - Array of resource level permissions with details
   */
  async getAccessGroupResourceLevelPermissions(access_group_id, resource_name, permission_id) {
    try {
      const permissions = await this.resourceLevelPermissionsManager.getAccessGroupResourceLevelPermissions(
        access_group_id,
        resource_name,
        permission_id
      );

      if (this.logging === 'console') {
        console.log(`[AccessControl] Retrieved ${permissions.length} resource level permissions for access group ${access_group_id}`);
      }

      return permissions;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error getting access group resource level permissions:', error);
      }
      throw error;
    }
  }

  /**
   * Get resource types that require resource-level access for a given permission
   * @param {number} permission_id - Permission ID
   * @returns {Promise<Array>} - Array of resource type names
   */
  async getResourceTypesForPermission(permission_id) {
    try {
      const resourceTypes = await this.resourceLevelPermissionsManager.getResourceTypesForPermission(permission_id);

      if (this.logging === 'console') {
        console.log(`[AccessControl] Retrieved ${resourceTypes.length} resource types for permission ${permission_id}`);
      }

      return resourceTypes;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error getting resource types for permission:', error);
      }
      throw error;
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
      const resourceType = await this.resourceLevelPermissionsManager.addResourceTypeForPermission(
        permission_id,
        resource_name
      );

      if (this.logging === 'console') {
        console.log(`[AccessControl] Added resource type '${resource_name}' for permission ${permission_id}`);
      }

      return resourceType;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error adding resource type for permission:', error);
      }
      throw error;
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
      const removed = await this.resourceLevelPermissionsManager.removeResourceTypeForPermission(
        permission_id,
        resource_name
      );

      if (this.logging === 'console') {
        console.log(`[AccessControl] ${removed ? 'Removed' : 'Failed to remove'} resource type '${resource_name}' for permission ${permission_id}`);
      }

      return removed;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error removing resource type for permission:', error);
      }
      throw error;
    }
  }

  /**
   * Get all permissions with their required resource types
   * @param {boolean} [includeWithoutResourceTypes=true] - Whether to include permissions that don't have resource type requirements
   * @returns {Promise<Array>} - Array of permissions with their resource types
   */
  async getAllPermissionsWithResourceTypes(includeWithoutResourceTypes = true) {
    try {
      const permissions = await this.resourceLevelPermissionsManager.getAllPermissionsWithResourceTypes(
        includeWithoutResourceTypes
      );

      if (this.logging === 'console') {
        console.log(`[AccessControl] Retrieved ${permissions.length} permissions with resource type information`);
      }

      return permissions;
    } catch (error) {
      if (this.logging === 'console') {
        console.error('[AccessControl] Error getting all permissions with resource types:', error);
      }
      throw error;
    }
  }
}

module.exports = AccessControl;
module.exports.DuplicateAccessGroupNameError = DuplicateAccessGroupNameError;
module.exports.DuplicatePermissionCodeError = DuplicatePermissionCodeError; 