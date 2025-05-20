/**
 * @fileoverview Main entry point for the Access Control module.
 */

const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const { validateTables, setupInitialData } = require('./src/utils/dbValidation');
const authMiddleware = require('./src/middleware/authMiddleware');
const { AccessGroupsManager } = require('./src/utils/accessGroupsManager');

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
    
    // Initialize cache if enabled
    this.cache = config.cache || false;
    if (this.cache === 'in-memory') {
      this.cacheEngine = new NodeCache(config.cache_config || {});
    }

    // Validate database tables and setup initial data
    this.validateAndSetupDb();
    
    // Initialize access groups manager
    this.accessGroupsManager = new AccessGroupsManager(this.db);
  }

  /**
   * Validate required database tables and setup initial data
   */
  async validateAndSetupDb() {
    try {
      await validateTables(this.db);
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
}

module.exports = AccessControl; 