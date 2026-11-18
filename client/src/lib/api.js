/**
 * RemoteView API Client
 * Centralized API communication layer with authentication and error handling.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Core fetch wrapper with authentication, JSON parsing, and error handling.
 * @param {string} endpoint - API endpoint (e.g., '/api/auth/login')
 * @param {object} [options={}] - Fetch options
 * @param {string} [options.method] - HTTP method
 * @param {object} [options.body] - Request body (will be JSON-stringified)
 * @param {object} [options.headers] - Additional headers
 * @param {boolean} [options.skipAuth] - Skip auth header
 * @returns {Promise<object>} Parsed JSON response
 */
export async function fetchAPI(endpoint, options = {}) {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;

  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Attach auth token if available
  if (!skipAuth && typeof window !== 'undefined') {
    const token = localStorage.getItem('remoteview_token');
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const config = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // Handle no-content responses
    if (response.status === 204) {
      return { success: true };
    }

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || data.error || 'Something went wrong');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.status) {
      throw error;
    }
    // Network or parsing error
    const networkError = new Error('Network error. Please check your connection.');
    networkError.status = 0;
    networkError.originalError = error;
    throw networkError;
  }
}

/* ============================================
   Auth API
   ============================================ */

/**
 * Log in with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{token: string, user: object}>}
 */
export async function loginAPI(email, password) {
  return fetchAPI('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  });
}

/**
 * Register a new account
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{token: string, user: object}>}
 */
export async function registerAPI(name, email, password) {
  return fetchAPI('/api/auth/register', {
    method: 'POST',
    body: { name, email, password },
    skipAuth: true,
  });
}

/**
 * Get the currently authenticated user
 * @returns {Promise<{user: object}>}
 */
export async function getMeAPI() {
  return fetchAPI('/api/auth/me');
}

/* ============================================
   Devices API
   ============================================ */

/**
 * List all devices for the authenticated user
 * @returns {Promise<{devices: object[]}>}
 */
export async function listDevicesAPI() {
  return fetchAPI('/api/devices');
}

/**
 * Register a new device
 * @param {object} deviceData - { name, model, androidVersion }
 * @returns {Promise<{device: object}>}
 */
export async function registerDeviceAPI(deviceData) {
  return fetchAPI('/api/devices', {
    method: 'POST',
    body: deviceData,
  });
}

/**
 * Update an existing device
 * @param {string} deviceId
 * @param {object} updates
 * @returns {Promise<{device: object}>}
 */
export async function updateDeviceAPI(deviceId, updates) {
  return fetchAPI(`/api/devices/${deviceId}`, {
    method: 'PUT',
    body: updates,
  });
}

/**
 * Delete a device
 * @param {string} deviceId
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteDeviceAPI(deviceId) {
  return fetchAPI(`/api/devices/${deviceId}`, {
    method: 'DELETE',
  });
}

/* ============================================
   Sessions API
   ============================================ */

/**
 * List all sessions for the authenticated user
 * @returns {Promise<{sessions: object[]}>}
 */
export async function listSessionsAPI() {
  return fetchAPI('/api/sessions');
}

/**
 * Create a new screen-sharing session
 * @param {object} [sessionData] - Optional session configuration
 * @returns {Promise<{session: object, invitationLink: string}>}
 */
export async function createSessionAPI(sessionData = {}) {
  return fetchAPI('/api/sessions', {
    method: 'POST',
    body: sessionData,
  });
}

/**
 * Get a specific session by ID
 * @param {string} sessionId
 * @returns {Promise<{session: object}>}
 */
export async function getSessionAPI(sessionId) {
  return fetchAPI(`/api/sessions/${sessionId}`);
}

/**
 * End an active session
 * @param {string} sessionId
 * @returns {Promise<{session: object}>}
 */
export async function endSessionAPI(sessionId) {
  return fetchAPI(`/api/sessions/${sessionId}/end`, {
    method: 'POST',
  });
}

/* ============================================
   Invitation API
   ============================================ */

/**
 * Get invitation details by token (no auth required)
 * @param {string} token - Invitation token
 * @returns {Promise<{invitation: object}>}
 */
export async function getInvitationAPI(token) {
  return fetchAPI(`/api/invite/${token}`, { skipAuth: true });
}

/**
 * Accept an invitation (no auth required)
 * @param {string} token - Invitation token
 * @param {object} [deviceInfo] - Optional device info from the sharer
 * @returns {Promise<{session: object, signalingToken: string}>}
 */
export async function acceptInvitationAPI(token, deviceInfo = {}) {
  return fetchAPI(`/api/invite/${token}/accept`, {
    method: 'POST',
    body: deviceInfo,
    skipAuth: true,
  });
}
