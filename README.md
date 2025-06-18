# Paasbaan - Access Control Module

A flexible and powerful access control module for Express.js applications with JWT authentication, permission-based authorization, and resource-level access control.

## Features

- JWT authentication
- Permission-based access control
- Route-level authorization
- Resource-level access control
- Support for user roles/access groups
- Permission caching (in-memory)
- CLI interface for managing permissions and access groups
- Database integration with Sequelize (MS SQL Server supported)

## Installation

```bash
npm install paasbaan
# or
yarn add paasbaan
# or
pnpm add paasbaan
```

## Requirements

- Node.js 16+
- Express.js
- Sequelize ORM
- A database supported by Sequelize (PostgreSQL, MySQL, SQLite, etc.)

## Database Setup

The module expects the following tables to exist in your database:

1. `access_groups` - Stores access groups/roles
   - `id`
   - `name`
   - `description`
   - `created_at`
   - `updated_at`
   - `deleted_at`

2. `permissions` - Stores permissions
   - `id`
   - `code`
   - `name`
   - `description`
   - `created_at`
   - `updated_at`
   - `deleted_at`

3. `access_group_permissions` - Join table for access groups and permissions
   - `id`
   - `access_group_id`
   - `permission_id`
   - `created_at`
   - `updated_at`
   - `deleted_at`

4. `access_groups_users` - Join table for access groups and users
   - `id`
   - `access_group_id`
   - `user_id`
   - `created_at`
   - `updated_at`
   - `deleted_at`

5. `resource_level_permissions_types` - Stores resource types for resource-level permissions
   - `id`
   - `permission_id` (foreign key to permissions table)
   - `name`
   - `created_at`
   - `updated_at`
   - `deleted_at`

6. `resource_level_permissions` - Stores resource-level permissions
   - `id`
   - `permission_id`
   - `resource_id`
   - `resource_type_id`
   - `access_group_id`
   - `created_at`
   - `updated_at`
   - `deleted_at`

You can create these tables using Sequelize migrations or directly in your database. Paasbaan will look for these sequelize models passed on to the module through sequelize database object.

## Permission-Resource Type Configuration

Before granting resource-level permissions, you must first define which resource types require resource-level access for specific permissions. This is done through the `resource_level_permissions_types` table, which links permissions to the resource types they can control.

### Setting Up Resource Type Requirements

```javascript
const accessControl = new AccessControl({ /* config */ });

// Define that 'read:observations' permission requires resource-level access for 'location'
await accessControl.addResourceTypeForPermission(5, 'location'); // 5 is the permission ID for 'read:observations'

// Define that 'read:observations' also requires resource-level access for 'department'
await accessControl.addResourceTypeForPermission(5, 'department');

// Define that 'update:observations' requires resource-level access for 'location'
await accessControl.addResourceTypeForPermission(6, 'location'); // 6 is the permission ID for 'update:observations'
```

## Usage

### Basic Setup

```javascript
const express = require('express');
const AccessControl = require('paasbaan');
const db = require('./db'); // Your Sequelize database instance

// Create Access Control instance
const accessControl = new AccessControl({
  db: db,
  route_access: {
    '/api/users': {
      method: 'GET',
      permissions: ['read:users']
    },
    '/api/users/:id': {
      method: 'GET',
      permissions: ['read:users', 'update:users']
    },
    '/api/admin': {
      method: 'GET',
      permissions: ['admin:access']
    }
  },
  cache: 'in-memory', // Optional, can be false or 'in-memory'
  cache_config: {     // Optional
    stdTTL: 60,       // Time to live in seconds
    checkperiod: 120  // Check period in seconds
  },
  userIdKey: 'userId', // Optional, default is 'userId'
  logging: 'console'   // Optional, can be false or 'console'
});

// Create Express app
const app = express();

// Use Access Control middleware
app.use(accessControl.getAuthMiddleware());

// Routes
app.get('/api/users', (req, res) => {
  res.json({ message: 'List of users' });
});

app.get('/api/users/:id', (req, res) => {
  res.json({ message: `User ${req.params.id} details` });
});

app.get('/api/admin', (req, res) => {
  res.json({ message: 'Admin dashboard' });
});

// Start server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});
```

### API Reference

#### Constructor

```javascript
const accessControl = new AccessControl(options);
```

Options:
- `db` (required) - Sequelize database instance
- `route_access` (required) - Route access configuration
- `cache` (optional) - Cache type, can be `false` or `'in-memory'`. Default: `false`
- `cache_config` (optional) - Cache configuration
- `userIdKey` (optional) - The key used to identify the user ID in JWT tokens. Default: `'userId'`
- `logging` (optional) - Logging mode, can be `false` or `'console'`. Default: `false`

#### Methods

##### `getAuthMiddleware()`

Returns the Express middleware function for authentication and authorization.

```javascript
app.use(accessControl.getAuthMiddleware());
```

##### `getUserPermissions(userId)`

Gets the user's permissions.

```javascript
const permissions = await accessControl.getUserPermissions(userId);
```

##### `hasPermission(userId, permissions)`

Checks if a user has the specified permissions.

```javascript
const hasAccess = await accessControl.hasPermission(userId, ['read:users']);
```

##### `createAccessGroup(accessGroup)`

Creates a new access group.

```javascript
const accessGroup = await accessControl.createAccessGroup({
  name: 'Editors',
  description: 'Users who can edit content'
});
```

##### `createPermission(permission)`

Creates a new permission.

```javascript
const permission = await accessControl.createPermission({
  code: 'edit:content',
  name: 'Edit Content',
  description: 'Permission to edit content'
});
```

##### `assignPermissionToAccessGroup(accessGroupId, permissionId)`

Assigns a permission to an access group.

```javascript
await accessControl.assignPermissionToAccessGroup(accessGroupId, permissionId);
```

##### `addUserToAccessGroup(accessGroupId, userId)`

Adds a user to an access group.

```javascript
await accessControl.addUserToAccessGroup(accessGroupId, userId);
```

##### `removeUserFromAccessGroup(accessGroupId, userId)`

Removes a user from an access group.

```javascript
const removed = await accessControl.removeUserFromAccessGroup(accessGroupId, userId);
console.log(removed); // true if removed, false if not found
```

##### `updateAccessGroup(accessGroupId, updateData)`

Updates an access group's information.

- `accessGroupId`: ID of the access group to update
- `updateData`: Object containing fields to update (`name`, `description`)

```javascript
// Update access group name and description
const updatedGroup = await accessControl.updateAccessGroup(1, {
  name: 'Senior Editors',
  description: 'Senior content editors with advanced permissions'
});

// Update only the description
const updatedGroup = await accessControl.updateAccessGroup(1, {
  description: 'Updated description'
});
```

##### `deleteAccessGroup(accessGroupId, force)`

Deletes an access group. By default, performs a soft delete.

- `accessGroupId`: ID of the access group to delete
- `force` (optional): If `true`, performs a hard delete. Default: `false`

**Important**: The access group must have no users, permissions, or resource-level permissions assigned before it can be deleted.

```javascript
// Soft delete (recommended)
const deleted = await accessControl.deleteAccessGroup(1);

// Hard delete (permanent)
const deleted = await accessControl.deleteAccessGroup(1, true);

// Example of safe deletion process
try {
  // Remove all users first
  const users = await accessControl.getUsersInAccessGroup(1);
  for (const user of users) {
    await accessControl.removeUserFromAccessGroup(1, user.id);
  }

  // Remove all permissions
  // Note: You'll need to implement removePermissionFromAccessGroup or remove manually

  // Now delete the access group
  const deleted = await accessControl.deleteAccessGroup(1);
} catch (error) {
  console.error('Error deleting access group:', error.message);
}
```

##### `getAccessGroupById(accessGroupId)`

Gets an access group by its ID.

```javascript
const accessGroup = await accessControl.getAccessGroupById(1);
if (accessGroup) {
  console.log(`Group: ${accessGroup.name} - ${accessGroup.description}`);
} else {
  console.log('Access group not found');
}
```

##### `removePermissionFromAccessGroup(accessGroupId, permissionId)`

Removes a permission from an access group.

```javascript
const removed = await accessControl.removePermissionFromAccessGroup(1, 5);
console.log(removed); // true if removed, false if not found
```

##### `clearUserCache(userId)`

Clears the cached permissions for a user.

```javascript
accessControl.clearUserCache(userId);
```

### Resource Level Permissions

Resource level permissions allow you to restrict access to specific resources (e.g., locations, departments) for users with specific permissions. This is useful when you want to grant users access to only certain instances of a resource type with specific permissions.

#### Example Usage

```javascript
const accessControl = new AccessControl({
  db: db,
  route_access: {
    '/api/observations': {
      method: 'GET',
      permissions: ['read:observations']
    }
  },
  cache: 'in-memory'
});

// Step 1: Get the permission ID for 'read:observations'
const permission = await accessControl.getPermissionByCode('read:observations');

// Step 2: Define that this permission requires resource-level access for 'location'
await accessControl.addResourceTypeForPermission(permission.id, 'location');

// Step 3: Grant access to specific locations for an access group with read permission
await accessControl.addResourceLevelPermission(
  permission.id,    // ID of the 'read:observations' permission
  [1, 2, 3],       // Array of location IDs
  'location',      // Resource type name
  accessGroupId    // Access group ID
);

// Check if a user has read access to specific locations
const hasAccess = await accessControl.hasResourceAccess(
  'location',      // Resource type name
  permission.id,   // ID of the 'read:observations' permission
  [1, 2],          // Array of location IDs to check
  userId           // User ID
);

// Get all locations a user has read access to
const accessibleLocations = await accessControl.getResourceLevelPermissions(
  'location',      // Resource type name
  permission.id,   // ID of the 'read:observations' permission
  userId           // User ID
);

// Get which resource types require resource-level access for this permission
const requiredResourceTypes = await accessControl.getResourceTypesForPermission(permission.id);
console.log(requiredResourceTypes); // ['location']

// Remove read access to specific locations
await accessControl.removeResourceLevelPermission(
  permission.id,   // ID of the permission
  [2, 3],          // Array of location IDs to remove
  'location',      // Resource type name
  accessGroupId    // Access group ID
);
```

#### Resource Level Permission Methods

##### `addResourceLevelPermission(permission_id, resource_ids, resource_name, access_group_id)`

Grants an access group permission to access specific resources.

- `permission_id`: ID of the permission
- `resource_ids`: Array of resource IDs to grant access to
- `resource_name`: Name of the resource type (e.g., 'location')
- `access_group_id`: ID of the access group

```javascript
await accessControl.addResourceLevelPermission(1, [1, 2, 3], 'location', 1);
```

##### `removeResourceLevelPermission(permission_id, resource_ids, resource_name, access_group_id)`

Removes an access group's permission to access specific resources.

- `permission_id`: ID of the permission
- `resource_ids`: Array of resource IDs to remove access from
- `resource_name`: Name of the resource type
- `access_group_id`: ID of the access group

```javascript
await accessControl.removeResourceLevelPermission(1, [2, 3], 'location', 1);
```

##### `getResourceLevelPermissions(resource_name, permission_id, user_id)`

Gets all resources of a specific type that a user has access to with a specific permission.

- `resource_name`: Name of the resource type
- `permission_id`: ID of the permission to check for
- `user_id`: ID of the user

```javascript
const accessibleResources = await accessControl.getResourceLevelPermissions('location', 1, 1);
```

##### `hasResourceAccess(resource_name, permission_id, resource_ids, user_id)`

Checks if a user has specific permission to access resources.

- `resource_name`: Name of the resource type
- `permission_id`: ID of the permission to check for
- `resource_ids`: Array of resource IDs to check
- `user_id`: ID of the user

```javascript
const hasAccess = await accessControl.hasResourceAccess('location', 1, [1, 2], 1);
```

##### `clearResourcePermissionsCache(user_id, resource_name, permission_id)`

Clears the cached resource permissions for a user.

- `user_id`: ID of the user
- `resource_name` (optional): Name of the resource type to clear cache for
- `permission_id` (optional): ID of the permission to clear cache for

```javascript
// Clear all resource permissions cache for a user
accessControl.clearResourcePermissionsCache(1);

// Clear cache for specific resource type and permission
accessControl.clearResourcePermissionsCache(1, 'location', 1);
```

##### `getAccessGroupResourceLevelPermissions(access_group_id, resource_name, permission_id)`

Gets resource level permissions assigned to an access group with optional filtering.

- `access_group_id`: ID of the access group
- `resource_name` (optional): Name of the resource type to filter by
- `permission_id` (optional): ID of the permission to filter by

Returns an object with a `permissions` array where each permission contains:
- `id`: Permission ID
- `code`: Permission code
- `name`: Permission name
- `resources`: Object with resource types as keys and arrays of resource IDs as values

```javascript
// Get all resource level permissions for an access group
const result = await accessControl.getAccessGroupResourceLevelPermissions(1);

// Get resource level permissions for specific resource type
const locationResult = await accessControl.getAccessGroupResourceLevelPermissions(1, 'location');

// Get resource level permissions for specific permission
const readResult = await accessControl.getAccessGroupResourceLevelPermissions(1, null, 5);

// Get resource level permissions for specific resource type and permission
const specificResult = await accessControl.getAccessGroupResourceLevelPermissions(1, 'location', 5);

// Example response structure:
// {
//   permissions: [
//     {
//       id: 4,
//       code: 'read:observations',
//       name: 'Read Observations',
//       resources: {
//         location: [1, 2, 4, 5],
//         department: [10, 15, 20]
//       }
//     },
//     {
//       id: 5,
//       code: 'update:observations',
//       name: 'Update Observations',
//       resources: {
//         location: [1, 2],
//         department: [10]
//       }
//     }
//   ]
// }
```

## CLI Usage

The module provides a CLI tool for managing access groups and permissions.

### Global Installation

```bash
npm install -g paasbaan
```

### CLI Commands

```bash
# Create a new access group
paasbaan create-access-group -c ./db-config.js -n "Editors" -d "Users who can edit content"

# Create a new permission
paasbaan create-permission -c ./db-config.js --code "edit:content" -n "Edit Content" -d "Permission to edit content"

# Assign a permission to an access group
paasbaan assign-permission -c ./db-config.js -g 1 -p 1

# Add a user to an access group
paasbaan add-user -c ./db-config.js -g 1 -u 1

# List all access groups
paasbaan list-access-groups -c ./db-config.js

# List all permissions
paasbaan list-permissions -c ./db-config.js

# Get user permissions
paasbaan get-user-permissions -c ./db-config.js -u 1
```

## Database Configuration File

The CLI commands require a database configuration file. This file should export a Sequelize configuration object:

```javascript
// db-config.js
module.exports = {
  database: 'my_database',
  username: 'user',
  password: 'password',
  host: 'localhost',
  dialect: 'postgres',
  logging: false
};
```

## License

MIT 

## Permission-Resource Type Management

These methods allow you to configure which resource types require resource-level access for specific permissions.

##### `getResourceTypesForPermission(permission_id)`

Gets the resource types that require resource-level access for a given permission.

- `permission_id`: ID of the permission

```javascript
// Get resource types that require resource-level access for permission ID 5
const resourceTypes = await accessControl.getResourceTypesForPermission(5);
console.log(resourceTypes); // ['location', 'department']
```

##### `addResourceTypeForPermission(permission_id, resource_name)`

Defines that a permission requires resource-level access for a specific resource type.

- `permission_id`: ID of the permission
- `resource_name`: Name of the resource type

```javascript
// Define that 'read:observations' permission (ID: 5) requires resource-level access for 'location'
await accessControl.addResourceTypeForPermission(5, 'location');

// Define that it also requires resource-level access for 'department'
await accessControl.addResourceTypeForPermission(5, 'department');
```

##### `removeResourceTypeForPermission(permission_id, resource_name)`

Removes the requirement for resource-level access for a specific resource type and permission.

- `permission_id`: ID of the permission
- `resource_name`: Name of the resource type

```javascript
// Remove the requirement for 'department' resource-level access for permission ID 5
const removed = await accessControl.removeResourceTypeForPermission(5, 'department');
console.log(removed); // true if removed, false if not found
```

##### `getAllPermissionsWithResourceTypes(includeWithoutResourceTypes)`

Gets all permissions along with their required resource types. Useful for admin interfaces and configuration management.

- `includeWithoutResourceTypes` (optional): Whether to include permissions that don't have resource type requirements. Default: `true`

Returns an array of permission objects with their resource types:
- `id`: Permission ID
- `code`: Permission code
- `name`: Permission name
- `description`: Permission description
- `resource_types`: Array of resource type names required for this permission

```javascript
// Get all permissions with their resource type requirements
const allPermissions = await accessControl.getAllPermissionsWithResourceTypes();

// Get only permissions that have resource type requirements
const permissionsWithResourceTypes = await accessControl.getAllPermissionsWithResourceTypes(false);

// Example response:
// [
//   {
//     id: 1,
//     code: 'read:users',
//     name: 'Read Users',
//     description: 'Permission to read user data',
//     resource_types: [] // No resource-level restrictions
//   },
//   {
//     id: 5,
//     code: 'read:observations',
//     name: 'Read Observations',
//     description: 'Permission to read observation data',
//     resource_types: ['location', 'department'] // Requires resource-level access
//   },
//   {
//     id: 6,
//     code: 'update:observations',
//     name: 'Update Observations',
//     description: 'Permission to update observation data',
//     resource_types: ['location'] // Requires resource-level access for locations only
//   }
// ]

// Usage in an admin interface
allPermissions.forEach(permission => {
  console.log(`Permission: ${permission.name} (${permission.code})`);
  if (permission.resource_types.length > 0) {
    console.log(`  Requires resource-level access for: ${permission.resource_types.join(', ')}`);
  } else {
    console.log(`  No resource-level restrictions`);
  }
});
```
