const { Sequelize } = require('sequelize');

function initModels(sequelize) {
  // Import model definitions
  const AccessGroup = require('./accessGroup')(sequelize);
  const Permission = require('./permission')(sequelize);
  const AccessGroupPermission = require('./accessGroupPermission')(sequelize);
  const User = require('./user')(sequelize);
  const AccessGroupUser = require('./accessGroupUser')(sequelize);
  const ResourceLevelPermissionType = require('./resourceLevelPermissionType')(sequelize);
  const ResourceLevelPermission = require('./resourceLevelPermission')(sequelize);

  // Set up associations
  AccessGroup.belongsToMany(Permission, {
    through: AccessGroupPermission,
    foreignKey: 'access_group_id',
    as: 'permissions'
  });

  Permission.belongsToMany(AccessGroup, {
    through: AccessGroupPermission,
    foreignKey: 'permission_id',
    as: 'access_groups'
  });

  AccessGroup.belongsToMany(User, {
    through: AccessGroupUser,
    foreignKey: 'access_group_id',
    as: 'users'
  });

  User.belongsToMany(AccessGroup, {
    through: AccessGroupUser,
    foreignKey: 'user_id',
    as: 'access_groups'
  });

  // Resource Level Permission associations
  ResourceLevelPermissionType.hasMany(ResourceLevelPermission, {
    foreignKey: 'resource_type_id',
    as: 'permissions'
  });

  ResourceLevelPermission.belongsTo(ResourceLevelPermissionType, {
    foreignKey: 'resource_type_id',
    as: 'resource_type'
  });

  Permission.hasMany(ResourceLevelPermission, {
    foreignKey: 'permission_id',
    as: 'resource_level_permissions'
  });

  ResourceLevelPermission.belongsTo(Permission, {
    foreignKey: 'permission_id',
    as: 'permission'
  });

  AccessGroup.hasMany(ResourceLevelPermission, {
    foreignKey: 'access_group_id',
    as: 'resource_level_permissions'
  });

  ResourceLevelPermission.belongsTo(AccessGroup, {
    foreignKey: 'access_group_id',
    as: 'access_group'
  });

  const models = {
    AccessGroup,
    Permission,
    AccessGroupPermission,
    User,
    AccessGroupUser,
    ResourceLevelPermissionType,
    ResourceLevelPermission
  };

  return models;
}

module.exports = { initModels }; 