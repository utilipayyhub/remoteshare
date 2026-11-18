const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Device model — represents a registered Android device.
 */
const Device = sequelize.define(
  'Device',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      field: 'user_id',
    },
    deviceName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Device name is required' },
      },
      field: 'device_name',
    },
    deviceModel: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'device_model',
    },
    androidVersion: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'android_version',
    },
    status: {
      type: DataTypes.ENUM('online', 'offline', 'sharing'),
      defaultValue: 'offline',
      allowNull: false,
    },
    lastSeen: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_seen',
    },
  },
  {
    tableName: 'devices',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Device;
