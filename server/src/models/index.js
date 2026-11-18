const { sequelize } = require('../config/database');
const User = require('./User');
const Device = require('./Device');
const Session = require('./Session');

// ─── Associations ───────────────────────────────────────────────────────────────

// User → Devices (one-to-many)
User.hasMany(Device, { foreignKey: 'userId', as: 'devices', onDelete: 'CASCADE' });
Device.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User → Sessions (one-to-many, as host/viewer)
User.hasMany(Session, { foreignKey: 'hostUserId', as: 'sessions', onDelete: 'CASCADE' });
Session.belongsTo(User, { foreignKey: 'hostUserId', as: 'host' });

// Device → Sessions (one-to-many)
Device.hasMany(Session, { foreignKey: 'deviceId', as: 'sessions', onDelete: 'SET NULL' });
Session.belongsTo(Device, { foreignKey: 'deviceId', as: 'device' });

module.exports = {
  sequelize,
  User,
  Device,
  Session,
};
