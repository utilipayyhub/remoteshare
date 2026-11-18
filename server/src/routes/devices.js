const express = require('express');
const { Device, Session } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All device routes require authentication
router.use(authenticate);

// ─── GET / — List the current user's devices ────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const devices = await Device.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Session,
          as: 'sessions',
          attributes: ['id', 'status', 'startedAt', 'endedAt'],
          limit: 5,
          order: [['createdAt', 'DESC']],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({ devices });
  } catch (error) {
    console.error('List devices error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── POST / — Register a new device ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { deviceName, deviceModel, androidVersion } = req.body;

    if (!deviceName) {
      return res.status(400).json({ error: 'Device name is required.' });
    }

    const device = await Device.create({
      userId: req.user.id,
      deviceName: deviceName.trim(),
      deviceModel: deviceModel?.trim() || null,
      androidVersion: androidVersion?.trim() || null,
      status: 'offline',
      lastSeen: new Date(),
    });

    return res.status(201).json({ message: 'Device registered.', device });
  } catch (error) {
    console.error('Register device error:', error);

    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }

    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── PUT /:id — Update device info ──────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const device = await Device.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }

    const { deviceName, deviceModel, androidVersion } = req.body;

    if (deviceName !== undefined) device.deviceName = deviceName.trim();
    if (deviceModel !== undefined) device.deviceModel = deviceModel?.trim() || null;
    if (androidVersion !== undefined) device.androidVersion = androidVersion?.trim() || null;

    await device.save();

    return res.status(200).json({ message: 'Device updated.', device });
  } catch (error) {
    console.error('Update device error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── DELETE /:id — Remove a device ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const device = await Device.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }

    await device.destroy();

    return res.status(200).json({ message: 'Device removed.' });
  } catch (error) {
    console.error('Delete device error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── PUT /:id/status — Update device status ─────────────────────────────────────
router.put('/:id/status', async (req, res) => {
  try {
    const device = await Device.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }

    const { status } = req.body;
    const validStatuses = ['online', 'offline', 'sharing'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    device.status = status;
    device.lastSeen = new Date();
    await device.save();

    return res.status(200).json({ message: 'Device status updated.', device });
  } catch (error) {
    console.error('Update device status error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
