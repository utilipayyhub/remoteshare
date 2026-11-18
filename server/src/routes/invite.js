const express = require('express');
const { Session, Device, User } = require('../models');

const router = express.Router();

// ─── GET /:token — Validate an invitation token ─────────────────────────────────
router.get('/:token', async (req, res) => {
  try {
    const session = await Session.findOne({
      where: { invitationToken: req.params.token },
      include: [
        {
          model: User,
          as: 'host',
          attributes: ['id', 'name'],
        },
      ],
    });

    if (!session) {
      return res.status(404).json({ error: 'Invalid invitation link.' });
    }

    // Check if the session has already ended
    if (session.status === 'ended') {
      return res.status(410).json({ error: 'This session has already ended.' });
    }

    // Check if the invitation has expired
    if (session.status === 'expired' || new Date() > new Date(session.expiresAt)) {
      // Update status if not already marked
      if (session.status !== 'expired') {
        session.status = 'expired';
        await session.save();
      }
      return res.status(410).json({ error: 'This invitation has expired.' });
    }

    return res.status(200).json({
      valid: true,
      session: {
        id: session.id,
        status: session.status,
        hostName: session.host?.name || 'Unknown',
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error('Validate invitation error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── POST /:token/accept — Accept an invitation ─────────────────────────────────
router.post('/:token/accept', async (req, res) => {
  try {
    const session = await Session.findOne({
      where: { invitationToken: req.params.token },
      include: [
        {
          model: User,
          as: 'host',
          attributes: ['id', 'name'],
        },
      ],
    });

    if (!session) {
      return res.status(404).json({ error: 'Invalid invitation link.' });
    }

    // Check if the session has already ended
    if (session.status === 'ended') {
      return res.status(410).json({ error: 'This session has already ended.' });
    }

    // Check if the invitation has expired
    if (session.status === 'expired' || new Date() > new Date(session.expiresAt)) {
      if (session.status !== 'expired') {
        session.status = 'expired';
        await session.save();
      }
      return res.status(410).json({ error: 'This invitation has expired.' });
    }

    // Register or link the device from the request body
    const { deviceName, deviceModel, androidVersion } = req.body;

    if (!deviceName) {
      return res.status(400).json({ error: 'Device name is required.' });
    }

    // Create a new device entry linked to the session host
    const device = await Device.create({
      userId: session.hostUserId,
      deviceName: deviceName.trim(),
      deviceModel: deviceModel?.trim() || null,
      androidVersion: androidVersion?.trim() || null,
      status: 'online',
      lastSeen: new Date(),
    });

    // Update the session: link the device and mark as active
    session.deviceId = device.id;
    session.status = 'active';
    session.startedAt = new Date();
    await session.save();

    return res.status(200).json({
      message: 'Invitation accepted. Screen sharing session is now active.',
      session: {
        id: session.id,
        status: session.status,
        startedAt: session.startedAt,
        hostName: session.host?.name || 'Unknown',
      },
      device: {
        id: device.id,
        deviceName: device.deviceName,
      },
      signaling: {
        wsUrl: `ws://${req.headers.host}`,
        sessionId: session.id,
        role: 'sharer',
      },
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
