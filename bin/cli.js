#!/usr/bin/env node

/**
 * Command-line interface for Access Control module
 * Provides commands for managing access groups, permissions, and user assignments
 */

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { initModels } = require('../src/models');
const { AccessGroupsManager } = require('../src/utils/accessGroupsManager');

// Set up program
program
  .name('paasbaan')
  .description('Access Control CLI')
  .version('1.0.0');

// Helper function to establish database connection
async function connectToDatabase(dbConfig) {
  try {
    const sequelize = new Sequelize(dbConfig);
    await sequelize.authenticate();
    console.log('Database connection established successfully');
    
    // Initialize models
    const models = initModels(sequelize);
    
    // Create a db object with sequelize instance and models
    const db = {
      sequelize,
      Sequelize,
      ...models
    };

    return db;
  } catch (error) {
    console.error('Error connecting to database:', error.message);
    process.exit(1);
  }
}

// Helper function to load database configuration
function loadDatabaseConfig(configPath) {
  try {
    const config = require(configPath);

    if (!config) {
      console.error('Invalid config file format');
      process.exit(1);
    }

    return config;
  } catch (error) {
    console.error('Error loading configuration:', error.message);
    process.exit(1);
  }
}

// Command: create access group
program
  .command('create-access-group')
  .description('Create a new access group')
  .requiredOption('-c, --config <path>', 'path to database config file')
  .requiredOption('-n, --name <name>', 'access group name')
  .option('-d, --description <description>', 'access group description')
  .action(async (options) => {
    try {
      const dbConfig = loadDatabaseConfig(path.resolve(options.config));
      const db = await connectToDatabase(dbConfig);
      
      const accessGroupsManager = new AccessGroupsManager(db);
      
      const accessGroup = await accessGroupsManager.createAccessGroup({
        name: options.name,
        description: options.description || ''
      });
      
      console.log('Access group created successfully:');
      console.log(JSON.stringify(accessGroup.toJSON(), null, 2));
      
      process.exit(0);
    } catch (error) {
      console.error('Error creating access group:', error.message);
      process.exit(1);
    }
  });

// Command: create permission
program
  .command('create-permission')
  .description('Create a new permission')
  .requiredOption('-c, --config <path>', 'path to database config file')
  .requiredOption('--code <code>', 'permission code')
  .requiredOption('-n, --name <name>', 'permission name')
  .option('-d, --description <description>', 'permission description')
  .action(async (options) => {
    try {
      const dbConfig = loadDatabaseConfig(path.resolve(options.config));
      const db = await connectToDatabase(dbConfig);
      
      const accessGroupsManager = new AccessGroupsManager(db);
      
      const permission = await accessGroupsManager.createPermission({
        code: options.code,
        name: options.name,
        description: options.description || ''
      });
      
      console.log('Permission created successfully:');
      console.log(JSON.stringify(permission.toJSON(), null, 2));
      
      process.exit(0);
    } catch (error) {
      console.error('Error creating permission:', error.message);
      process.exit(1);
    }
  });

// Command: assign permission to access group
program
  .command('assign-permission')
  .description('Assign a permission to an access group')
  .requiredOption('-c, --config <path>', 'path to database config file')
  .requiredOption('-g, --group <id>', 'access group ID')
  .requiredOption('-p, --permission <id>', 'permission ID')
  .action(async (options) => {
    try {
      const dbConfig = loadDatabaseConfig(path.resolve(options.config));
      const db = await connectToDatabase(dbConfig);
      
      const accessGroupsManager = new AccessGroupsManager(db);
      
      const accessGroupPermission = await accessGroupsManager.assignPermissionToAccessGroup(
        options.group,
        options.permission
      );
      
      console.log('Permission assigned to access group successfully:');
      console.log(JSON.stringify(accessGroupPermission.toJSON(), null, 2));
      
      process.exit(0);
    } catch (error) {
      console.error('Error assigning permission to access group:', error.message);
      process.exit(1);
    }
  });

// Command: add user to access group
program
  .command('add-user')
  .description('Add a user to an access group')
  .requiredOption('-c, --config <path>', 'path to database config file')
  .requiredOption('-g, --group <id>', 'access group ID')
  .requiredOption('-u, --user <id>', 'user ID')
  .action(async (options) => {
    try {
      const dbConfig = loadDatabaseConfig(path.resolve(options.config));
      const db = await connectToDatabase(dbConfig);
      
      const accessGroupsManager = new AccessGroupsManager(db);
      
      const accessGroupUser = await accessGroupsManager.addUserToAccessGroup(
        options.group,
        options.user
      );
      
      console.log('User added to access group successfully:');
      console.log(JSON.stringify(accessGroupUser.toJSON(), null, 2));
      
      process.exit(0);
    } catch (error) {
      console.error('Error adding user to access group:', error.message);
      process.exit(1);
    }
  });

// Command: list access groups
program
  .command('list-access-groups')
  .description('List all access groups')
  .requiredOption('-c, --config <path>', 'path to database config file')
  .action(async (options) => {
    try {
      const dbConfig = loadDatabaseConfig(path.resolve(options.config));
      const db = await connectToDatabase(dbConfig);
      
      const accessGroupsManager = new AccessGroupsManager(db);
      
      const accessGroups = await accessGroupsManager.getAllAccessGroups();
      
      console.log('Access groups:');
      console.log(JSON.stringify(accessGroups.map(group => group.toJSON()), null, 2));
      
      process.exit(0);
    } catch (error) {
      console.error('Error listing access groups:', error.message);
      process.exit(1);
    }
  });

// Command: list permissions
program
  .command('list-permissions')
  .description('List all permissions')
  .requiredOption('-c, --config <path>', 'path to database config file')
  .action(async (options) => {
    try {
      const dbConfig = loadDatabaseConfig(path.resolve(options.config));
      const db = await connectToDatabase(dbConfig);
      
      const accessGroupsManager = new AccessGroupsManager(db);
      
      const permissions = await accessGroupsManager.getAllPermissions();
      
      console.log('Permissions:');
      console.log(JSON.stringify(permissions.map(permission => permission.toJSON()), null, 2));
      
      process.exit(0);
    } catch (error) {
      console.error('Error listing permissions:', error.message);
      process.exit(1);
    }
  });

// Command: get user permissions
program
  .command('get-user-permissions')
  .description('Get permissions for a user')
  .requiredOption('-c, --config <path>', 'path to database config file')
  .requiredOption('-u, --user <id>', 'user ID')
  .action(async (options) => {
    try {
      const dbConfig = loadDatabaseConfig(path.resolve(options.config));
      const db = await connectToDatabase(dbConfig);
      
      const accessGroupsManager = new AccessGroupsManager(db);
      
      const permissions = await accessGroupsManager.getUserPermissions(options.user);
      
      console.log('User permissions:');
      console.log(JSON.stringify(permissions, null, 2));
      
      process.exit(0);
    } catch (error) {
      console.error('Error getting user permissions:', error.message);
      process.exit(1);
    }
  });

// Parse command-line arguments
program.parse(process.argv); 