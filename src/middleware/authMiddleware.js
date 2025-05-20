/**
 * Authentication and authorization middleware for Express.js
 * Validates JWT tokens and checks user permissions
 */

const jwt = require('jsonwebtoken');
const { AccessGroupsManager } = require('../utils/accessGroupsManager');

/**
 * Create authentication middleware
 * @param {Object} options - Middleware options
 * @param {Object} options.db - Sequelize database instance
 * @param {Object} options.route_access - Route access configuration
 * @param {string} options.userIdKey - User ID key in JWT token
 * @param {Object|boolean} options.cache - Cache instance or false
 * @param {string|boolean} options.logging - Logging type
 * @returns {Function} Express middleware function
 */
function authMiddleware(options) {
  const { db, route_access, userIdKey, cache, logging } = options;

  if (!db) {
    throw new Error('Database instance is required');
  }

  if (!route_access) {
    throw new Error('Route access configuration is required');
  }

  const accessGroupsManager = new AccessGroupsManager(db);

  /**
   * Get user permissions
   * @param {string|number} userId - User ID
   * @returns {Promise<Array>} - Array of permission codes
   */
  async function getUserPermissions(userId) {
    try {
      // Check cache first if enabled
      if (cache) {
        const cacheKey = `user_permissions_${userId}`;
        const cachedPermissions = cache.get(cacheKey);
        
        if (cachedPermissions) {
          return cachedPermissions;
        }
      }

      // Fetch permissions from database
      const permissions = await accessGroupsManager.getUserPermissions(userId);

      // Set cache if enabled
      if (cache) {
        const cacheKey = `user_permissions_${userId}`;
        cache.set(cacheKey, permissions);
      }

      return permissions;
    } catch (error) {
      if (logging === 'console') {
        console.error('[AuthMiddleware] Error getting user permissions:', error);
      }
      throw error;
    }
  }

  /**
   * Check if route requires authentication
   * @param {string} path - Request path
   * @param {string} method - Request method
   * @returns {Object|null} - Route access object or null if route does not require authentication
   */
  function getRouteAccess(path, method) {
    // Normalize path and method
    const normalizedMethod = method.toUpperCase();
    
    // Find matching route in route_access
    for (const routePath in route_access) {
      // Convert route path to regex pattern
      const pattern = routePath
        .replace(/:[^/]+/g, '([^/]+)')  // Replace :param with a capture group
        .replace(/\//g, '\\/');         // Escape forward slashes
      
      const regex = new RegExp(`^${pattern}$`);
      
      // Check if the request path matches the route path
      if (regex.test(path)) {
        const route = route_access[routePath];
        
        // Check if the request method matches the route method
        if (route.method === normalizedMethod) {
          return route;
        }
      }
    }
    
    return null;
  }

  /**
   * Express middleware function
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   * @returns {void}
   */
  return async function(req, res, next) {
    try {
      // Check if route requires authentication
      const routeAccess = getRouteAccess(req.path, req.method);
      
      // If route does not require authentication, continue
      if (!routeAccess) {
        return next();
      }
      
      // Extract token from authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (logging === 'console') {
          console.log(`[AuthMiddleware] Authentication failed: No Bearer token provided for ${req.method} ${req.path}`);
        }
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const token = authHeader.split(' ')[1];
      
      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      } catch (error) {
        if (logging === 'console') {
          console.log(`[AuthMiddleware] Authentication failed: Invalid token for ${req.method} ${req.path}`);
        }
        return res.status(401).json({ message: 'Authentication failed: Invalid token' });
      }
      
      // Get user ID from token
      const userId = decoded[userIdKey];
      
      if (!userId) {
        if (logging === 'console') {
          console.log(`[AuthMiddleware] Authentication failed: User ID not found in token for ${req.method} ${req.path}`);
        }
        return res.status(401).json({ message: 'Authentication failed: User ID not found in token' });
      }
      
      // Get user permissions
      let userPermissions;
      try {
        userPermissions = await getUserPermissions(userId);
      } catch (error) {
        if (logging === 'console') {
          console.error(`[AuthMiddleware] Error getting user permissions: ${error.message}`);
        }
        return res.status(500).json({ message: 'Internal server error' });
      }
      
      // Check if user has super_admin permission
      if (userPermissions.includes('super_admin')) {
        if (logging === 'console') {
          console.log(`[AuthMiddleware] Access granted to ${req.method} ${req.path}: User ${userId} has super_admin permission`);
        }
        // Add user ID and permissions to request object
        req.userId = userId;
        req.userPermissions = userPermissions;
        return next();
      }
      
      // Check if user has any of the required permissions
      const requiredPermissions = routeAccess.permissions;
      const hasPermission = requiredPermissions.some(permission => userPermissions.includes(permission));
      
      if (hasPermission) {
        if (logging === 'console') {
          console.log(`[AuthMiddleware] Access granted to ${req.method} ${req.path}: User ${userId} has required permissions`);
        }
        // Add user ID and permissions to request object
        req.userId = userId;
        req.userPermissions = userPermissions;
        return next();
      }
      
      if (logging === 'console') {
        console.log(`[AuthMiddleware] Access denied to ${req.method} ${req.path}: User ${userId} does not have required permissions`);
      }
      return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    } catch (error) {
      if (logging === 'console') {
        console.error(`[AuthMiddleware] Error processing request: ${error.message}`);
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
}

module.exports = authMiddleware; 