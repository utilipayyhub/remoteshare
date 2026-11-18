const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Session model — represents a screen-sharing session between a viewer and an Android device.
 */
const Session = sequelize.define(
  'Session',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    hostUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      field: 'host_user_id',
    },
    deviceId: {
      type: DataTypes.UUID,
      allowNull: true, // nullable until the device connects
      references: { model: 'devices', key: 'id' },
      field: 'device_id',
    },
    invitationToken: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'invitation_token',
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'ended', 'expired'),
      defaultValue: 'pending',
      allowNull: false,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at',
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'ended_at',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
  },
  {
    tableName: 'sessions',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Session;
