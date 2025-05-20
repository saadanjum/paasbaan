const { Sequelize } = require('sequelize');

function initModels(sequelize) {
  // Import model definitions
  const AccessGroup = require('./accessGroup')(sequelize);
  const Permission = require('./permission')(sequelize);
  const User = require('./user')(sequelize);
  const AccessGroupPermission = require('./accessGroupPermission')(sequelize);
  const AccessGroupUser = require('./accessGroupUser')(sequelize);

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

  const models = {
    AccessGroup,
    Permission,
    AccessGroupPermission,
    User,
    AccessGroupUser
  };

  return models;
}

module.exports = { initModels }; 