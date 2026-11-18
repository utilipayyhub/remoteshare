require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { sequelize, testConnection } = require('./config/database');
const { initSignaling } = require('./websocket/signaling');
const { Session } = require('./models');
const { Op } = require('sequelize');

// ─── Route imports ──────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const sessionRoutes = require('./routes/sessions');
const inviteRoutes = require('./routes/invite');

// ─── Express app setup ──────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// ─── Middleware ─────────────────────────────────────────────────────────────────

// Security headers
app.use(helmet());

// CORS — allow the dashboard client origin and all Vercel deployments
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile companion, curl) or localhost, or any vercel.app
      if (!origin || origin.includes('localhost') || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter — 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// ─── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/invite', inviteRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// 404 handler for unknown API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// ─── WebSocket signaling ────────────────────────────────────────────────────────
const wss = initSignaling(server);

// ─── Session expiry cleanup (runs every hour) ───────────────────────────────────
let cleanupInterval = null;

async function cleanupExpiredSessions() {
  try {
    const [affectedCount] = await Session.update(
      { status: 'expired' },
      {
        where: {
          status: 'pending',
          expiresAt: { [Op.lt]: new Date() },
        },
      }
    );
    if (affectedCount > 0) {
      console.log(`🧹 Marked ${affectedCount} expired session(s).`);
    }
  } catch (error) {
    console.error('Session cleanup error:', error.message);
  }
}

// ─── Start server ───────────────────────────────────────────────────────────────
async function start() {
  try {
    // Test database connection
    await testConnection();

    // Sync models (safe for SQLite, alter for PostgreSQL in development)
    const dialect = sequelize.getDialect();
    const syncOptions = dialect === 'sqlite' ? {} : (process.env.NODE_ENV === 'development' ? { alter: true } : {});
    await sequelize.sync(syncOptions);
    console.log('✅ Database models synchronised.');

    // Run initial cleanup safely, then schedule hourly
    try {
      await cleanupExpiredSessions();
    } catch (cleanupErr) {
      console.warn('Initial session cleanup notice:', cleanupErr.message);
    }
    cleanupInterval = setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

    // Listen on all network interfaces (required for cloud containers like Render)
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 RemoteView server running on port ${PORT}`);
      console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Client URL  : ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ─── Graceful shutdown ──────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully…`);

  // Stop the cleanup interval
  if (cleanupInterval) clearInterval(cleanupInterval);

  // Close WebSocket server
  wss.close(() => {
    console.log('🔌 WebSocket server closed.');
  });

  // Close HTTP server
  server.close(async () => {
    console.log('🌐 HTTP server closed.');

    // Close database connection
    try {
      await sequelize.close();
      console.log('🗄️  Database connection closed.');
    } catch (err) {
      console.error('Error closing database:', err.message);
    }

    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start the application
start();
