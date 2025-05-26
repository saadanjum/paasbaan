const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ResourceLevelPermissionType = sequelize.define('ResourceLevelPermissionType', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
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
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'resource_level_permissions_types',
    underscored: true,
    paranoid: true,
    timestamps: true
  });

  return ResourceLevelPermissionType;
}; 