# Paasbaan - Access Control Module

A flexible and powerful access control module for Express.js applications with JWT authentication and permission-based authorization.

## Features

- JWT authentication
- Permission-based access control
- Route-level authorization
- Support for user roles/access groups
- Permission caching (in-memory)
- CLI interface for managing permissions and access groups
- Database integration with Sequelize

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

You can create these tables using Sequelize migrations or directly in your database.

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

##### `clearUserCache(userId)`

Clears the cached permissions for a user.

```javascript
accessControl.clearUserCache(userId);
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