const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AccessGroupPermission = sequelize.define('AccessGroupPermission', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    access_group_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'access_groups',
        key: 'id'
      }
    },
    permission_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'permissions',
        key: 'id'
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'access_group_permissions',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['access_group_id', 'permission_id']
      }
    ]
  });
  
  return AccessGroupPermission;
}; 