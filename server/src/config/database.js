const { Sequelize } = require('sequelize');
const path = require('path');

/**
 * Sequelize instance configured from DATABASE_URL.
 * Supports PostgreSQL with SSL in production, or SQLite for local development.
 */
let sequelize;
const dbUrl = process.env.DATABASE_URL;

if (dbUrl && dbUrl.startsWith('postgres')) {
  sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? false : false,
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
  // Embedded SQLite database in current working directory
  const dbPath = path.resolve(process.cwd(), 'remoteview.sqlite');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false,
  });
}

/**
 * Test the database connection and log the result.
 * @returns {Promise<boolean>} true if connection succeeds
 */
async function testConnection() {
  try {
    await sequelize.authenticate();
    const dialect = sequelize.getDialect();
    console.log(`✅ Database connection established successfully (${dialect.toUpperCase()}).`);
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    throw error;
  }
}

module.exports = { sequelize, testConnection };
