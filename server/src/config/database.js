const path = require('path');
const dbUrl = process.env.DATABASE_URL;

let sequelize;

if (dbUrl && dbUrl.startsWith('postgres')) {
  const { Sequelize } = require('sequelize');
  sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions:
      process.env.NODE_ENV === 'production'
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          }
        : {},
  });
} else {
  // Pure JavaScript Database Adapter - zero C++ native glibc dependencies
  const { sequelize: pureSequelize } = require('./pureDb');
  sequelize = pureSequelize;
}

async function testConnection() {
  try {
    await sequelize.authenticate();
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    throw error;
  }
}

module.exports = { sequelize, testConnection };
