'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheckIcon,
  DevicePhoneMobileIcon,
  StopIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  LockClosedIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { getInvitationAPI, acceptInvitationAPI } from '@/lib/api';
import useWebRTC from '@/hooks/useWebRTC';

/**
 * Helper to detect basic Android device info from user agent
 */
function detectDeviceInfo() {
  if (typeof window === 'undefined') {
    return { deviceName: 'Android Device', deviceModel: 'Android', androidVersion: '14' };
  }

  const ua = navigator.userAgent;
  let deviceModel = 'Android Phone';
  let androidVersion = '14';

  const matchAndroid = ua.match(/Android\s([0-9\.]+)/);
  if (matchAndroid) {
    androidVersion = matchAndroid[1];
  }

  // Common Android manufacturers / models in UA
  const matchModel = ua.match(/;\s([A-Za-z0-9\s_\-]+)\sBuild\//);
  if (matchModel) {
    deviceModel = matchModel[1].trim();
  }

  return {
    deviceName: `${deviceModel} (Android ${androidVersion})`,
    deviceModel,
    androidVersion,
  };
}

export default function InviteAcceptancePage() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(null);
  const [declined, setDeclined] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [startingSharing, setStartingSharing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const sessionId = invitation?.session?.id;

  // WebRTC hook configured as sharer
  const {
    localStream,
    connectionState,
    signalingState,
    error: rtcError,
    startSharing,
    stopSharing,
  } = useWebRTC({
    sessionId: sessionId || '',
    role: 'sharer',
    token: token || '',
  });

  // Fetch invitation validity
  useEffect(() => {
    async function loadInvitation() {
      try {
        setLoading(true);
        setError(null);
        const data = await getInvitationAPI(token);
        setInvitation(data);
      } catch (err) {
        console.error('Failed to validate invitation:', err);
        setError(err.message || 'This invitation is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadInvitation();
    }
  }, [token]);

  // Handle start sharing
  const handleStartSharing = async () => {
    setStartingSharing(true);
    setError(null);

    try {
      const deviceInfo = detectDeviceInfo();

      // 1. Accept invitation on backend
      await acceptInvitationAPI(token, deviceInfo);

      // 2. Start WebRTC screen capture & stream
      await startSharing();

      setIsSharing(true);
    } catch (err) {
      console.error('Start sharing error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Screen sharing permission was denied. Please allow permission to proceed.');
      } else {
        setError(err.message || 'Failed to start screen sharing.');
      }
    } finally {
      setStartingSharing(false);
    }
  };

  // Handle stop sharing
  const handleStopSharing = useCallback(() => {
    stopSharing();
    setIsSharing(false);
  }, [stopSharing]);

  // Track stream termination from native browser controls (e.g. user clicks browser "Stop sharing")
  useEffect(() => {
    if (localStream) {
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          handleStopSharing();
        };
      }
    }
  }, [localStream, handleStopSharing]);

  // Elapsed timer when sharing is active
  useEffect(() => {
    let timer;
    if (isSharing) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isSharing]);

  const formatTimer = (totalSec) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b16] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Verifying invitation link...</p>
        </div>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="min-h-screen bg-[#070b16] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-500/10 text-gray-400 flex items-center justify-center mx-auto mb-4">
            <LockClosedIcon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Invitation Declined</h2>
          <p className="text-gray-400 text-sm mb-6">
            You declined the screen sharing request. No information was shared from your device.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Learn more about RemoteView
          </Link>
        </div>
      </div>
    );
  }

  if (error && !isSharing) {
    return (
      <div className="min-h-screen bg-[#070b16] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white/[0.03] border border-rose-500/20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <ExclamationTriangleIcon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Invitation Invalid</h2>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Go to RemoteView
          </Link>
        </div>
      </div>
    );
  }

  const hostName = invitation?.session?.hostName || 'A remote user';

  return (
    <div className="min-h-screen bg-[#070b16] text-gray-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Persistent Notification Header when Active */}
      {isSharing && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-rose-600/95 backdrop-blur-md px-4 py-3 text-white shadow-xl flex items-center justify-between border-b border-rose-400/30">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-white animate-ping" />
            <div>
              <p className="text-xs sm:text-sm font-semibold tracking-wide">
                SCREEN SHARING ACTIVE
              </p>
              <p className="text-[11px] text-rose-100">
                Streaming to {hostName} &bull; {formatTimer(elapsedSeconds)}
              </p>
            </div>
          </div>
          <button
            onClick={handleStopSharing}
            className="px-3.5 py-1.5 bg-white text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
          >
            STOP SHARING
          </button>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-center gap-2 py-4 ${isSharing ? 'mt-12' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
          <DevicePhoneMobileIcon className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg text-white">RemoteView</span>
      </div>

      {/* Main Content Card */}
      <main className="max-w-md w-full mx-auto my-auto py-4">
        <AnimatePresence mode="wait">
          {!isSharing ? (
            <motion.div
              key="consent"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 shadow-2xl backdrop-blur-xl"
            >
              {/* Request Intro */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-cyan-400 flex items-center justify-center mx-auto mb-4">
                  <EyeIcon className="w-8 h-8" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  Screen Sharing Request
                </h1>
                <p className="text-sm text-gray-300">
                  <strong className="text-white font-semibold">{hostName}</strong> is requesting to view your Android screen live.
                </p>
              </div>

              {/* What will be shared */}
              <div className="mb-6 space-y-3 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                <div className="flex items-start gap-3">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-300 leading-relaxed">
                    <strong className="text-white font-medium">Real-Time Screen Display:</strong> The remote viewer will see whatever is visible on your device screen.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldCheckIcon className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-300 leading-relaxed">
                    <strong className="text-white font-medium">End-to-End Encrypted:</strong> Media stream is protected with SRTP encryption.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <LockClosedIcon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-300 leading-relaxed">
                    <strong className="text-white font-medium">Full Control:</strong> You can stop sharing at any second with a single tap. No background recording.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleStartSharing}
                  disabled={startingSharing}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-95 disabled:opacity-50"
                >
                  {startingSharing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Granting Permission...
                    </span>
                  ) : (
                    'Grant Permission & Start Sharing'
                  )}
                </button>

                <button
                  onClick={() => setDeclined(true)}
                  disabled={startingSharing}
                  className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Decline Request
                </button>
              </div>

              {/* Companion App Note */}
              <div className="mt-6 pt-5 border-t border-white/5 text-center">
                <p className="text-[11px] text-gray-400">
                  Using Android 10+? For background streaming and system notifications, see our{' '}
                  <span className="text-cyan-400 font-medium">Native Companion App guide</span>.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="sharing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-rose-500/30 shadow-2xl backdrop-blur-xl text-center"
            >
              <div className="w-20 h-20 rounded-full bg-rose-500/15 border-2 border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-6 relative">
                <span className="w-full h-full rounded-full absolute bg-rose-500/10 animate-ping" />
                <DevicePhoneMobileIcon className="w-10 h-10" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-1">
                You Are Sharing Your Screen
              </h2>
              <p className="text-sm text-gray-300 mb-4">
                Streaming live to <strong className="text-white">{hostName}</strong>
              </p>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 font-mono text-cyan-400 text-lg mb-8">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span>{formatTimer(elapsedSeconds)}</span>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleStopSharing}
                  className="w-full py-4 px-4 bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white rounded-xl font-bold text-base transition-all shadow-xl shadow-rose-600/30 active:scale-95 flex items-center justify-center gap-2"
                >
                  <StopIcon className="w-5 h-5" />
                  <span>STOP SCREEN SHARING</span>
                </button>

                <p className="text-xs text-gray-400">
                  You can safely minimize this browser tab or switch to any other Android app.
                  Screen sharing will continue until you tap Stop.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-400">
        RemoteView &bull; End-to-End Encrypted Screen Sharing
      </footer>
    </div>
  );
}
