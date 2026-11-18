const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Session, Device, User } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All session routes require authentication
router.use(authenticate);

// ─── GET / — List the current user's sessions ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.findAll({
      where: { hostUserId: req.user.id },
      include: [
        {
          model: Device,
          as: 'device',
          attributes: ['id', 'deviceName', 'deviceModel', 'status'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({ sessions });
  } catch (error) {
    console.error('List sessions error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── POST / — Create a new session with an invitation token ─────────────────────
router.post('/', async (req, res) => {
  try {
    const invitationToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    const session = await Session.create({
      hostUserId: req.user.id,
      invitationToken,
      status: 'pending',
      expiresAt,
    });

    return res.status(201).json({
      message: 'Session created.',
      session,
      invitationToken,
      inviteLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/invite/${invitationToken}`,
    });
  } catch (error) {
    console.error('Create session error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── GET /:id — Get session details ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findOne({
      where: { id: req.params.id, hostUserId: req.user.id },
      include: [
        {
          model: Device,
          as: 'device',
          attributes: ['id', 'deviceName', 'deviceModel', 'androidVersion', 'status'],
        },
        {
          model: User,
          as: 'host',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    return res.status(200).json({ session });
  } catch (error) {
    console.error('Get session error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── POST /:id/end — End an active session ──────────────────────────────────────
router.post('/:id/end', async (req, res) => {
  try {
    const session = await Session.findOne({
      where: { id: req.params.id, hostUserId: req.user.id },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    if (session.status === 'ended') {
      return res.status(400).json({ error: 'Session has already ended.' });
    }

    if (session.status === 'expired') {
      return res.status(400).json({ error: 'Session has expired.' });
    }

    session.status = 'ended';
    session.endedAt = new Date();
    await session.save();

    // If a device is linked, set it back to online
    if (session.deviceId) {
      const device = await Device.findByPk(session.deviceId);
      if (device && device.status === 'sharing') {
        device.status = 'online';
        device.lastSeen = new Date();
        await device.save();
      }
    }

    return res.status(200).json({ message: 'Session ended.', session });
  } catch (error) {
    console.error('End session error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── GET /:id/stats — Get session statistics ────────────────────────────────────
router.get('/:id/stats', async (req, res) => {
  try {
    const session = await Session.findOne({
      where: { id: req.params.id, hostUserId: req.user.id },
      include: [
        {
          model: Device,
          as: 'device',
          attributes: ['id', 'deviceName', 'deviceModel'],
        },
      ],
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // Calculate duration in seconds
    let durationSeconds = null;
    if (session.startedAt) {
      const endTime = session.endedAt ? new Date(session.endedAt) : new Date();
      durationSeconds = Math.floor((endTime - new Date(session.startedAt)) / 1000);
    }

    // Format duration as human-readable string
    let durationFormatted = null;
    if (durationSeconds !== null) {
      const hours = Math.floor(durationSeconds / 3600);
      const minutes = Math.floor((durationSeconds % 3600) / 60);
      const seconds = durationSeconds % 60;
      durationFormatted = `${hours}h ${minutes}m ${seconds}s`;
    }

    return res.status(200).json({
      stats: {
        sessionId: session.id,
        status: session.status,
        device: session.device || null,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationSeconds,
        durationFormatted,
        isActive: session.status === 'active',
        isExpired: session.status === 'expired' || new Date() > new Date(session.expiresAt),
      },
    });
  } catch (error) {
    console.error('Session stats error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
