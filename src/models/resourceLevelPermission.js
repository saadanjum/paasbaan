const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ResourceLevelPermission = sequelize.define('ResourceLevelPermission', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    permission_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'permissions',
        key: 'id'
      }
    },
    resource_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    resource_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'resource_level_permissions_types',
        key: 'id'
      }
    },
    access_group_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'access_groups',
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
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'resource_level_permissions',
    underscored: true,
    paranoid: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['permission_id', 'resource_id', 'resource_type_id', 'access_group_id'],
        where: {
          deleted_at: null
        }
      }
    ]
  });

  return ResourceLevelPermission;
}; 