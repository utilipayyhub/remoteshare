const dbUrl = process.env.DATABASE_URL;

if (dbUrl && dbUrl.startsWith('postgres')) {
  const { sequelize } = require('../config/database');
  const User = require('./User');
  const Device = require('./Device');
  const Session = require('./Session');

  User.hasMany(Device, { foreignKey: 'userId', as: 'devices', onDelete: 'CASCADE' });
  Device.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  User.hasMany(Session, { foreignKey: 'hostUserId', as: 'sessions', onDelete: 'CASCADE' });
  Session.belongsTo(User, { foreignKey: 'hostUserId', as: 'host' });

  Device.hasMany(Session, { foreignKey: 'deviceId', as: 'sessions', onDelete: 'SET NULL' });
  Session.belongsTo(Device, { foreignKey: 'deviceId', as: 'device' });

  module.exports = {
    sequelize,
    User,
    Device,
    Session,
  };
} else {
  // Pure JavaScript Storage Engine - 100% portable on any OS / Linux glibc
  const pureDb = require('../config/pureDb');
  module.exports = pureDb;
}
