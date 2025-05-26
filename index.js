/**
 * @fileoverview Main entry point for the Access Control module.
 */

const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const { validateTables, setupInitialData } = require('./src/utils/dbValidation');
const authMiddleware = require('./src/middleware/authMiddleware');
const { AccessGroupsManager } = require('./src/utils/accessGroupsManager');
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
}

module.exports = AccessControl; 