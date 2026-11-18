const { WebSocketServer } = require('ws');
const url = require('url');
const { Session } = require('../models');

/**
 * Room-based WebSocket signaling server for WebRTC.
 *
 * Each session acts as a room. Two peers join a room:
 *  - 'viewer'  — the dashboard user watching the screen
 *  - 'sharer'  — the Android device sharing its screen
 *
 * Supported message types:
 *  join, offer, answer, ice-candidate, leave
 */

/** Map<sessionId, Map<role, WebSocket>> */
const rooms = new Map();

/** Heartbeat interval reference (for cleanup on shutdown) */
let heartbeatInterval = null;

/**
 * Initialise the WebSocket signaling server on an existing HTTP server.
 * @param {import('http').Server} httpServer
 */
function initSignaling(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  console.log('🔌 WebSocket signaling server initialised on /ws');

  // ── Ping/pong heartbeat (every 30 s) ──────────────────────────────────────
  heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log('💔 Terminating unresponsive client');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  // ── Connection handler ────────────────────────────────────────────────────
  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.sessionId = null;
    ws.role = null;

    // Check if query params were passed in URL (e.g. from Android app)
    try {
      const parsedUrl = url.parse(req.url, true);
      const { sessionId, role } = parsedUrl.query;
      if (sessionId && role) {
        handleJoin(ws, { sessionId, role });
      }
    } catch (err) {
      console.warn('Error parsing connection URL query:', err.message);
    }

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return sendError(ws, 'Invalid JSON payload.');
      }

      const { type } = message;

      switch (type) {
        case 'join':
          await handleJoin(ws, message);
          break;
        case 'offer':
          handleRelay(ws, message);
          break;
        case 'answer':
          handleRelay(ws, message);
          break;
        case 'ice-candidate':
          handleRelay(ws, message);
          break;
        case 'leave':
          handleLeave(ws);
          break;
        default:
          sendError(ws, `Unknown message type: ${type}`);
      }
    });

    ws.on('close', () => {
      handleLeave(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
      handleLeave(ws);
    });
  });

  return wss;
}

// ─── Message Handlers ─────────────────────────────────────────────────────────

/**
 * Handle a 'join' message: validate the session and register the client in a room.
 */
async function handleJoin(ws, message) {
  const sessionId = message.sessionId || message.data?.sessionId;
  const role = message.role || message.data?.role;

  // Validate inputs
  if (!sessionId || !role) {
    return sendError(ws, 'sessionId and role are required to join.');
  }

  const validRoles = ['viewer', 'sharer'];
  if (!validRoles.includes(role)) {
    return sendError(ws, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  // Validate that the session exists and is active or pending
  try {
    const session = await Session.findByPk(sessionId);
    if (!session) {
      return sendError(ws, 'Session not found.');
    }
    if (session.status === 'ended' || session.status === 'expired') {
      return sendError(ws, `Session is ${session.status}.`);
    }
  } catch (err) {
    console.error('Session lookup error:', err.message);
    return sendError(ws, 'Failed to validate session.');
  }

  // Create the room if it doesn't exist
  if (!rooms.has(sessionId)) {
    rooms.set(sessionId, new Map());
  }

  const room = rooms.get(sessionId);

  // Check if the role is already taken
  if (room.has(role)) {
    const existing = room.get(role);
    if (existing !== ws && existing.readyState === existing.OPEN) {
      return sendError(ws, `Role '${role}' is already taken in this session.`);
    }
  }

  // If this client was in another room, leave it first
  if (ws.sessionId) {
    handleLeave(ws);
  }

  // Register the client in the room
  ws.sessionId = sessionId;
  ws.role = role;
  room.set(role, ws);

  console.log(`👤 ${role} joined session ${sessionId} (${room.size} peer(s))`);

  // Notify the client of a successful join
  sendMessage(ws, {
    type: 'joined',
    sessionId,
    role,
    peersInRoom: Array.from(room.keys()),
  });

  // Notify the existing peer that someone joined
  const peerRole = role === 'viewer' ? 'sharer' : 'viewer';
  const peer = room.get(peerRole);
  if (peer && peer.readyState === peer.OPEN) {
    sendMessage(peer, {
      type: 'peer-joined',
      role,
      sessionId,
    });
    sendMessage(peer, {
      type: 'peer-connected',
      role,
      sessionId,
      data: { role, sessionId },
    });
  }
}

/**
 * Relay a signaling message (offer / answer / ice-candidate) to the peer in the same room.
 */
function handleRelay(ws, message) {
  if (!ws.sessionId || !ws.role) {
    return sendError(ws, 'You must join a session before sending signaling messages.');
  }

  const room = rooms.get(ws.sessionId);
  if (!room) {
    return sendError(ws, 'Session room not found.');
  }

  const peerRole = ws.role === 'viewer' ? 'sharer' : 'viewer';
  const peer = room.get(peerRole);

  if (!peer || peer.readyState !== peer.OPEN) {
    return sendError(ws, 'Peer is not connected.');
  }

  // Forward the message to the peer, adding the sender's role
  sendMessage(peer, {
    type: message.type,
    data: message.data,
    from: ws.role,
  });
}

/**
 * Handle a client leaving (explicit 'leave' or disconnection).
 */
function handleLeave(ws) {
  if (!ws.sessionId) return;

  const sessionId = ws.sessionId;
  const role = ws.role;
  const room = rooms.get(sessionId);

  if (room) {
    // Only remove if this ws is the one registered (guards against stale references)
    if (room.get(role) === ws) {
      room.delete(role);
    }

    // Notify the remaining peer
    const peerRole = role === 'viewer' ? 'sharer' : 'viewer';
    const peer = room.get(peerRole);
    if (peer && peer.readyState === peer.OPEN) {
      sendMessage(peer, {
        type: 'peer-left',
        role,
        sessionId,
      });
      sendMessage(peer, {
        type: 'peer-disconnected',
        role,
        sessionId,
        data: { role, sessionId },
      });
    }

    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(sessionId);
      console.log(`🧹 Room ${sessionId} cleaned up (empty)`);
    }
  }

  console.log(`👋 ${role} left session ${sessionId}`);
  ws.sessionId = null;
  ws.role = null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function sendMessage(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendError(ws, errorMessage) {
  sendMessage(ws, { type: 'error', error: errorMessage });
}

/**
 * Returns the current rooms map (useful for diagnostics).
 */
function getRooms() {
  return rooms;
}

module.exports = { initSignaling, getRooms };
