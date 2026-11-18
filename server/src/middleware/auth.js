const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * JWT authentication middleware.
 * Expects: Authorization: Bearer <token>
 * Attaches the authenticated user to req.user on success.
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    let decoded;
    try {
      const secret = process.env.JWT_SECRET || 'remoteview_default_secret_key_32bytes_min';
      decoded = jwt.verify(token, secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired. Please log in again.' });
      }
      return res.status(401).json({ error: 'Invalid token.' });
    }

    // Fetch user from database to ensure they still exist
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }

    // Attach user to the request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

module.exports = { authenticate };
