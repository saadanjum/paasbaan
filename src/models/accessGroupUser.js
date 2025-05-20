const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AccessGroupUser = sequelize.define('AccessGroupUser', {
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
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
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
    tableName: 'access_groups_users',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['access_group_id', 'user_id']
      }
    ]
  });
  
  return AccessGroupUser;
}; 