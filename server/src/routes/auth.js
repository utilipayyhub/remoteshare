const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * Generate a signed JWT for the given user.
 * @param {object} user - User model instance
 * @returns {string} signed JWT
 */
function generateToken(user) {
  const secret = process.env.JWT_SECRET || 'remoteview_default_secret_key_32bytes_min';
  return jwt.sign({ userId: user.id, email: user.email }, secret, {
    expiresIn: process.env.JWT_EXPIRY || '7d',
  });
}

// ─── POST /register ─────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Input validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check for existing user
    const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase().trim(),
      password,
      name: name.trim(),
    });

    const token = generateToken(user);

    return res.status(201).json({
      message: 'Registration successful.',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Register error:', error);

    // Handle Sequelize validation errors
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }

    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── POST /login ─────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find user by email
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Validate password
    const isValid = await user.validatePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── GET /me ─────────────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    return res.status(200).json({ user: req.user.toJSON() });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
