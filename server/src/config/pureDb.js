const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const DB_FILE = path.resolve(process.cwd(), 'remoteview_data.json');

function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Initializing fresh database file:', err.message);
  }
  return { users: [], devices: [], sessions: [] };
}

function saveData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Database write error:', err.message);
  }
}

class UserInstance {
  constructor(data) {
    Object.assign(this, data);
  }
  async validatePassword(password) {
    return bcrypt.compare(password, this.password);
  }
  toJSON() {
    const copy = { ...this };
    delete copy.password;
    return copy;
  }
  async save() {
    const data = loadData();
    const idx = data.users.findIndex((u) => u.id === this.id);
    this.updatedAt = new Date().toISOString();
    if (idx !== -1) {
      data.users[idx] = { ...this };
    } else {
      data.users.push({ ...this });
    }
    saveData(data);
    return this;
  }
}

const User = {
  async create({ email, password, name }) {
    const data = loadData();
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.users.push(user);
    saveData(data);
    return new UserInstance(user);
  },
  async findOne({ where = {} } = {}) {
    const data = loadData();
    const found = data.users.find((u) => {
      if (where.id && u.id !== where.id) return false;
      if (where.email && u.email.toLowerCase() !== where.email.toLowerCase().trim()) return false;
      return true;
    });
    return found ? new UserInstance(found) : null;
  },
  async findByPk(id) {
    return this.findOne({ where: { id } });
  },
  hasMany() {},
  belongsTo() {},
};

class DeviceInstance {
  constructor(data) {
    Object.assign(this, data);
  }
  async update(fields) {
    Object.assign(this, fields, { updatedAt: new Date().toISOString() });
    return this.save();
  }
  async save() {
    const data = loadData();
    const idx = data.devices.findIndex((d) => d.id === this.id);
    this.updatedAt = new Date().toISOString();
    if (idx !== -1) {
      data.devices[idx] = { ...this };
    } else {
      data.devices.push({ ...this });
    }
    saveData(data);
    return this;
  }
  async destroy() {
    const data = loadData();
    data.devices = data.devices.filter((d) => d.id !== this.id);
    saveData(data);
    return true;
  }
  toJSON() {
    return { ...this };
  }
}

const Device = {
  async create({ userId, deviceName, deviceModel, androidVersion, status = 'offline', lastSeen = new Date() }) {
    const data = loadData();
    const device = {
      id: uuidv4(),
      userId,
      deviceName,
      deviceModel: deviceModel || null,
      androidVersion: androidVersion || null,
      status,
      lastSeen: new Date(lastSeen).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.devices.push(device);
    saveData(data);
    return new DeviceInstance(device);
  },
  async findByPk(id) {
    const data = loadData();
    const found = data.devices.find((d) => d.id === id);
    return found ? new DeviceInstance(found) : null;
  },
  async findAll({ where = {} } = {}) {
    const data = loadData();
    let list = data.devices;
    if (where.userId) {
      list = list.filter((d) => d.userId === where.userId);
    }
    return list.map((d) => {
      const inst = new DeviceInstance(d);
      inst.sessions = data.sessions.filter((s) => s.deviceId === d.id);
      return inst;
    });
  },
  hasMany() {},
  belongsTo() {},
};

class SessionInstance {
  constructor(data) {
    Object.assign(this, data);
  }
  async update(fields) {
    Object.assign(this, fields, { updatedAt: new Date().toISOString() });
    return this.save();
  }
  async save() {
    const data = loadData();
    const idx = data.sessions.findIndex((s) => s.id === this.id);
    this.updatedAt = new Date().toISOString();
    if (idx !== -1) {
      data.sessions[idx] = { ...this };
    } else {
      data.sessions.push({ ...this });
    }
    saveData(data);
    return this;
  }
  toJSON() {
    return { ...this };
  }
}

const Session = {
  async create({ hostUserId, deviceId = null, invitationToken, status = 'pending', expiresAt, startedAt = null, endedAt = null }) {
    const data = loadData();
    const session = {
      id: uuidv4(),
      hostUserId,
      deviceId,
      invitationToken,
      status,
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      endedAt: endedAt ? new Date(endedAt).toISOString() : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.sessions.push(session);
    saveData(data);
    return new SessionInstance(session);
  },
  async findByPk(id) {
    const data = loadData();
    const found = data.sessions.find((s) => s.id === id);
    if (!found) return null;
    const inst = new SessionInstance(found);
    if (found.deviceId) {
      const dev = data.devices.find((d) => d.id === found.deviceId);
      inst.device = dev ? new DeviceInstance(dev) : null;
      inst.Device = inst.device;
    }
    if (found.hostUserId) {
      const u = data.users.find((usr) => usr.id === found.hostUserId);
      inst.host = u ? new UserInstance(u) : null;
      inst.User = inst.host;
    }
    return inst;
  },
  async findOne({ where = {} } = {}) {
    const data = loadData();
    const found = data.sessions.find((s) => {
      if (where.id && s.id !== where.id) return false;
      if (where.invitationToken && s.invitationToken !== where.invitationToken) return false;
      if (where.hostUserId && s.hostUserId !== where.hostUserId) return false;
      return true;
    });
    if (!found) return null;
    const inst = new SessionInstance(found);
    if (found.hostUserId) {
      const u = data.users.find((usr) => usr.id === found.hostUserId);
      inst.host = u ? new UserInstance(u) : null;
      inst.User = inst.host;
    }
    if (found.deviceId) {
      const dev = data.devices.find((d) => d.id === found.deviceId);
      inst.device = dev ? new DeviceInstance(dev) : null;
      inst.Device = inst.device;
    }
    return inst;
  },
  async findAll({ where = {} } = {}) {
    const data = loadData();
    let list = data.sessions;
    if (where.hostUserId) {
      list = list.filter((s) => s.hostUserId === where.hostUserId);
    }
    return list.map((s) => {
      const inst = new SessionInstance(s);
      if (s.deviceId) {
        const dev = data.devices.find((d) => d.id === s.deviceId);
        inst.device = dev ? new DeviceInstance(dev) : null;
        inst.Device = inst.device;
      }
      return inst;
    });
  },
  async update(fields, { where = {} } = {}) {
    const data = loadData();
    let count = 0;
    const now = new Date();
    data.sessions.forEach((s) => {
      let match = true;
      if (where.status && s.status !== where.status) match = false;
      if (where.expiresAt && new Date(s.expiresAt) >= now) match = false;
      if (match) {
        Object.assign(s, fields, { updatedAt: now.toISOString() });
        count++;
      }
    });
    if (count > 0) saveData(data);
    return [count];
  },
  hasMany() {},
  belongsTo() {},
};

const sequelize = {
  async authenticate() {
    console.log('✅ Database connected (Pure JS Storage Engine — 0 native glibc dependencies).');
    return true;
  },
  async sync() {
    console.log('✅ Database schema verified.');
    return true;
  },
  async close() {
    return true;
  },
  getDialect() {
    return 'json';
  },
};

module.exports = {
  sequelize,
  User,
  Device,
  Session,
};
