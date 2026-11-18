/**
 * RemoteView WebSocket Signaling Client
 * Handles real-time signaling communication for WebRTC session negotiation.
 * Supports auto-reconnect with exponential backoff and heartbeat keep-alive.
 */

const WS_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, 'ws')
  : 'ws://localhost:5000';

export class SignalingClient {
  constructor() {
    /** @type {WebSocket|null} */
    this.ws = null;
    /** @type {string|null} */
    this.sessionId = null;
    /** @type {'viewer'|'sharer'|null} */
    this.role = null;
    /** @type {string|null} */
    this.token = null;

    // Reconnection state
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 10;
    this._reconnectTimer = null;
    this._intentionalClose = false;

    // Heartbeat state
    this._heartbeatTimer = null;
    this._heartbeatInterval = 25000; // 25 seconds
    this._pongTimeout = null;
    this._pongWait = 10000; // 10 seconds

    // Event handlers (consumers set these)
    this.onOffer = null;
    this.onAnswer = null;
    this.onIceCandidate = null;
    this.onPeerConnected = null;
    this.onPeerDisconnected = null;
    this.onError = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onReconnecting = null;
  }

  /**
   * Connect to the signaling server
   * @param {string} sessionId - The session ID to join
   * @param {'viewer'|'sharer'} role - The role of this peer
   * @param {string} token - Authentication / signaling token
   * @returns {Promise<void>} Resolves when connected
   */
  connect(sessionId, role, token) {
    return new Promise((resolve, reject) => {
      this.sessionId = sessionId;
      this.role = role;
      this.token = token;
      this._intentionalClose = false;
      this._reconnectAttempts = 0;

      this._createConnection(resolve, reject);
    });
  }

  /**
   * Create a new WebSocket connection
   * @private
   */
  _createConnection(resolve, reject) {
    try {
      const wsUrl = `${WS_BASE_URL}/ws?sessionId=${this.sessionId}&role=${this.role}&token=${this.token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this._reconnectAttempts = 0;
        this._startHeartbeat();

        // Send explicit join message to signaling server
        this.send('join', {
          sessionId: this.sessionId,
          role: this.role,
          token: this.token,
        });

        if (this.onConnected) {
          this.onConnected();
        }

        if (resolve) {
          resolve();
          resolve = null;
        }
      };

      this.ws.onmessage = (event) => {
        this._handleMessage(event);
      };

      this.ws.onclose = (event) => {
        this._stopHeartbeat();

        if (this.onDisconnected) {
          this.onDisconnected(event.code, event.reason);
        }

        if (!this._intentionalClose) {
          this._attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        if (this.onError) {
          this.onError(error);
        }

        if (reject) {
          reject(new Error('WebSocket connection failed'));
          reject = null;
        }
      };
    } catch (error) {
      if (reject) {
        reject(error);
      }
    }
  }

  /**
   * Handle incoming WebSocket messages
   * @private
   * @param {MessageEvent} event
   */
  _handleMessage(event) {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'offer':
          if (this.onOffer) this.onOffer(message.data);
          break;

        case 'answer':
          if (this.onAnswer) this.onAnswer(message.data);
          break;

        case 'ice-candidate':
          if (this.onIceCandidate) this.onIceCandidate(message.data);
          break;

        case 'peer-connected':
        case 'peer-joined':
          if (this.onPeerConnected) this.onPeerConnected(message.data || message);
          break;

        case 'peer-disconnected':
        case 'peer-left':
          if (this.onPeerDisconnected) this.onPeerDisconnected(message.data || message);
          break;

        case 'pong':
          // Clear pong timeout — server is alive
          if (this._pongTimeout) {
            clearTimeout(this._pongTimeout);
            this._pongTimeout = null;
          }
          break;

        case 'error':
          if (this.onError) this.onError(new Error(message.data?.message || 'Server error'));
          break;

        default:
          console.warn('[SignalingClient] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[SignalingClient] Failed to parse message:', error);
    }
  }

  /**
   * Send a message through the signaling channel
   * @param {string} type - Message type (e.g., 'offer', 'answer', 'ice-candidate')
   * @param {object} data - Message payload
   */
  send(type, data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[SignalingClient] Cannot send — WebSocket is not open');
      return;
    }

    this.ws.send(JSON.stringify({ type, data }));
  }

  /**
   * Gracefully disconnect from the signaling server
   */
  disconnect() {
    this._intentionalClose = true;
    this._stopHeartbeat();

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Client disconnecting');
      }
      this.ws = null;
    }

    this.sessionId = null;
    this.role = null;
    this.token = null;
  }

  /**
   * Start the heartbeat ping interval
   * @private
   */
  _startHeartbeat() {
    this._stopHeartbeat();

    this._heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send('ping', {});

        // Set a timeout for pong response
        this._pongTimeout = setTimeout(() => {
          console.warn('[SignalingClient] Pong timeout — closing connection');
          if (this.ws) {
            this.ws.close(4000, 'Pong timeout');
          }
        }, this._pongWait);
      }
    }, this._heartbeatInterval);
  }

  /**
   * Stop the heartbeat
   * @private
   */
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    if (this._pongTimeout) {
      clearTimeout(this._pongTimeout);
      this._pongTimeout = null;
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   * @private
   */
  _attemptReconnect() {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.error('[SignalingClient] Max reconnect attempts reached');
      if (this.onError) {
        this.onError(new Error('Unable to reconnect to signaling server'));
      }
      return;
    }

    this._reconnectAttempts++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s... capped at 30s
    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 30000);

    if (this.onReconnecting) {
      this.onReconnecting(this._reconnectAttempts, delay);
    }

    this._reconnectTimer = setTimeout(() => {
      this._createConnection(null, null);
    }, delay);
  }

  /**
   * Check if the client is currently connected
   * @returns {boolean}
   */
  get isConnected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

/** Singleton instance for convenience */
let _defaultClient = null;

/**
 * Get or create the default signaling client instance
 * @returns {SignalingClient}
 */
export function getSignalingClient() {
  if (!_defaultClient) {
    _defaultClient = new SignalingClient();
  }
  return _defaultClient;
}
