/**
 * Database Setup Script
 * Run this script to create the database tables
 * Usage: node src/scripts/setupDb.js
 */

require('dotenv').config();
const { sequelize } = require('../models');

async function setupDatabase() {
  try {
    console.log('🔄 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    console.log('🔄 Syncing database models...');
    await sequelize.sync({ alter: true });
    console.log('✅ Database tables created/updated successfully.');

    console.log('\n📋 Created tables:');
    const tables = await sequelize.getQueryInterface().showAllTables();
    tables.forEach(table => console.log(`   - ${table}`));

    console.log('\n🎉 Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. PostgreSQL is running');
    console.error('2. The database specified in DATABASE_URL exists');
    console.error('3. The credentials in .env are correct');
    console.error('\nTo create the database manually:');
    console.error('   psql -U postgres -c "CREATE DATABASE remoteview;"');
    process.exit(1);
  }
}

setupDatabase();
