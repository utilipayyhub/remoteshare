'use client';

/**
 * useWebRTC - Custom hook for WebRTC peer connection management.
 * Handles both viewer (receiving) and sharer (sending) roles,
 * ICE candidate exchange, offer/answer negotiation, and stream lifecycle.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { SignalingClient } from '@/lib/websocket';

/** STUN/TURN server configuration */
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

/**
 * @typedef {'new'|'connecting'|'connected'|'disconnected'|'failed'|'closed'} ConnectionState
 */

/**
 * WebRTC hook for managing peer connections
 * @param {object} options
 * @param {string} options.sessionId - The session ID
 * @param {'viewer'|'sharer'} options.role - The peer role
 * @param {string} options.token - Auth or signaling token
 * @returns {object} WebRTC state and controls
 */
export default function useWebRTC({ sessionId, role, token }) {
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [signalingState, setSignalingState] = useState('disconnected');
  const [error, setError] = useState(null);

  /** @type {React.MutableRefObject<RTCPeerConnection|null>} */
  const peerConnectionRef = useRef(null);
  /** @type {React.MutableRefObject<SignalingClient|null>} */
  const signalingRef = useRef(null);
  /** @type {React.MutableRefObject<RTCIceCandidate[]>} */
  const pendingCandidatesRef = useRef([]);
  const isNegotiatingRef = useRef(false);

  /**
   * Create and configure a new RTCPeerConnection
   * @private
   */
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Track connection state changes
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'failed') {
        setError('Peer connection failed');
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected') {
        setConnectionState('disconnected');
      }
    };

    // Send ICE candidates to remote peer via signaling
    pc.onicecandidate = (event) => {
      if (event.candidate && signalingRef.current?.isConnected) {
        signalingRef.current.send('ice-candidate', {
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle incoming tracks (viewer receives these)
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, []);

  /**
   * Flush any ICE candidates queued before remote description was set
   * @private
   */
  const flushPendingCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn('[WebRTC] Failed to add buffered ICE candidate:', err);
      }
    }
    pendingCandidatesRef.current = [];
  }, []);

  /**
   * Set up signaling event handlers
   * @private
   */
  const setupSignaling = useCallback(() => {
    const signaling = signalingRef.current;
    if (!signaling) return;

    // Handle incoming offer (viewer receives this from sharer)
    signaling.onOffer = async (data) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await flushPendingCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        signaling.send('answer', { sdp: pc.localDescription });
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
        setError('Failed to handle incoming offer');
      }
    };

    // Handle incoming answer (sharer receives this from viewer)
    signaling.onAnswer = async (data) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await flushPendingCandidates();
        isNegotiatingRef.current = false;
      } catch (err) {
        console.error('[WebRTC] Error handling answer:', err);
        setError('Failed to handle answer');
      }
    };

    // Handle incoming ICE candidate
    signaling.onIceCandidate = async (data) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      const candidate = new RTCIceCandidate(data.candidate);

      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.warn('[WebRTC] Failed to add ICE candidate:', err);
        }
      } else {
        // Queue until remote description is set
        pendingCandidatesRef.current.push(candidate);
      }
    };

    // Handle peer events
    signaling.onPeerConnected = (data) => {
      // If we're the sharer and the viewer just connected, create an offer
      if (role === 'sharer' && peerConnectionRef.current && localStream) {
        createAndSendOffer();
      }
    };

    signaling.onPeerDisconnected = () => {
      setConnectionState('disconnected');
    };

    signaling.onError = (err) => {
      setError(err.message || 'Signaling error');
    };

    signaling.onConnected = () => {
      setSignalingState('connected');
    };

    signaling.onDisconnected = () => {
      setSignalingState('disconnected');
    };

    signaling.onReconnecting = (attempt, delay) => {
      setSignalingState('reconnecting');
    };
  }, [role, flushPendingCandidates]);

  /**
   * Create an SDP offer and send it via signaling
   * @private
   */
  const createAndSendOffer = useCallback(async () => {
    const pc = peerConnectionRef.current;
    const signaling = signalingRef.current;
    if (!pc || !signaling?.isConnected || isNegotiatingRef.current) return;

    try {
      isNegotiatingRef.current = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signaling.send('offer', { sdp: pc.localDescription });
    } catch (err) {
      console.error('[WebRTC] Error creating offer:', err);
      isNegotiatingRef.current = false;
      setError('Failed to create connection offer');
    }
  }, []);

  /**
   * Start viewing a remote screen (viewer role)
   * Connects to signaling and waits for the sharer's stream.
   */
  const startViewing = useCallback(async () => {
    try {
      setError(null);
      setConnectionState('connecting');

      // Create peer connection
      const pc = createPeerConnection();

      // Add transceiver to receive video
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Connect to signaling server
      const signaling = new SignalingClient();
      signalingRef.current = signaling;
      setupSignaling();

      await signaling.connect(sessionId, 'viewer', token);
    } catch (err) {
      console.error('[WebRTC] startViewing error:', err);
      setError(err.message || 'Failed to start viewing');
      setConnectionState('failed');
    }
  }, [sessionId, token, createPeerConnection, setupSignaling]);

  /**
   * Start sharing the screen (sharer role)
   * Captures the screen and streams it to the viewer.
   */
  const startSharing = useCallback(async () => {
    try {
      setError(null);
      setConnectionState('connecting');

      // Capture screen
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });

      setLocalStream(stream);

      // Handle the user stopping screen share via the browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };

      // Create peer connection and add tracks
      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Connect to signaling server
      const signaling = new SignalingClient();
      signalingRef.current = signaling;
      setupSignaling();

      await signaling.connect(sessionId, 'sharer', token);

      // Create and send offer
      await createAndSendOffer();
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Screen sharing permission was denied');
      } else {
        console.error('[WebRTC] startSharing error:', err);
        setError(err.message || 'Failed to start sharing');
      }
      setConnectionState('failed');
    }
  }, [sessionId, token, createPeerConnection, setupSignaling, createAndSendOffer]);

  /**
   * Stop sharing and clean up all resources
   */
  const stopSharing = useCallback(() => {
    // Stop all local tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Disconnect signaling
    if (signalingRef.current) {
      signalingRef.current.disconnect();
      signalingRef.current = null;
    }

    setRemoteStream(null);
    setConnectionState('closed');
    setSignalingState('disconnected');
  }, [localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (signalingRef.current) {
        signalingRef.current.disconnect();
      }
    };
  }, []);

  return {
    remoteStream,
    localStream,
    connectionState,
    signalingState,
    error,
    startViewing,
    startSharing,
    stopSharing,
  };
}
