'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  StopIcon,
  ShareIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  SignalIcon,
  ClockIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionAPI, endSessionAPI } from '@/lib/api';
import useWebRTC from '@/hooks/useWebRTC';
import ScreenViewer from '@/components/ScreenViewer';
import InvitationDialog from '@/components/InvitationDialog';

export default function SessionLiveViewerPage() {
  const { id: sessionId } = useParams();
  const router = useRouter();
  const { token, isAuthenticated, loading: authLoading } = useAuth();

  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [ending, setEnding] = useState(false);

  // Initialize WebRTC hook
  const {
    remoteStream,
    connectionState,
    signalingState,
    error: rtcError,
    startViewing,
    stopSharing,
  } = useWebRTC({
    sessionId,
    role: 'viewer',
    token,
  });

  // Auth check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load session details
  const fetchSession = useCallback(async () => {
    try {
      setLoadingSession(true);
      const res = await getSessionAPI(sessionId);
      const sessionData = res.session || res;
      setSession(sessionData);

      if (sessionData.status === 'ended') {
        setSessionError('This session has already ended.');
      } else if (sessionData.status === 'expired') {
        setSessionError('This invitation has expired.');
      }
    } catch (err) {
      console.error('Failed to get session:', err);
      setSessionError(err.message || 'Session not found.');
    } finally {
      setLoadingSession(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (isAuthenticated && sessionId) {
      fetchSession();
    }
  }, [isAuthenticated, sessionId, fetchSession]);

  // Start WebRTC viewing once session is loaded and valid
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (session && session.status !== 'ended' && session.status !== 'expired' && !hasStartedRef.current && token) {
      hasStartedRef.current = true;
      startViewing();
    }
  }, [session, token, startViewing]);

  // Live timer for active session
  useEffect(() => {
    let timer;
    if (session?.startedAt && session.status === 'active') {
      const startTime = new Date(session.startedAt).getTime();
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setDuration(Math.max(0, elapsed));
      };
      updateTimer();
      timer = setInterval(updateTimer, 1000);
    } else if (session?.status === 'active' && !session?.startedAt) {
      timer = setInterval(() => setDuration((prev) => prev + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [session]);

  const handleEndSession = async () => {
    if (!confirm('Are you sure you want to end this remote screen sharing session?')) return;
    try {
      setEnding(true);
      stopSharing();
      await endSessionAPI(sessionId);
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to end session:', err);
      alert(err.message || 'Error ending session');
    } finally {
      setEnding(false);
    }
  };

  const handleCopyLink = async () => {
    const inviteLink = `${window.location.origin}/invite/${session?.invitationToken || sessionId}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const formatTimer = (totalSec) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const h = Math.floor(m / 60);
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#070b16] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Connecting to session...</p>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-[#070b16] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white/[0.03] border border-rose-500/20 text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <ExclamationTriangleIcon className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Session Unavailable</h2>
          <p className="text-gray-400 text-sm mb-6">{sessionError}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  const deviceName = session?.Device?.deviceName || session?.Device?.deviceModel || 'Android Device';

  return (
    <div className="min-h-screen bg-[#050811] text-gray-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-16 px-4 sm:px-6 bg-[#090e1c]/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm sm:text-base">
                Live Viewer
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 font-mono">
                {sessionId.slice(0, 8)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <DevicePhoneMobileIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>{deviceName}</span>
            </div>
          </div>
        </div>

        {/* Live Duration Counter & Status */}
        <div className="hidden sm:flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-gray-200">
            <ClockIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>{formatTimer(duration)}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{connectionState.toUpperCase()}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium border border-white/10 transition-colors"
          >
            <ShareIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Invite Link</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors"
            title="Copy invitation link"
          >
            {copied ? (
              <CheckIcon className="w-4 h-4 text-emerald-400" />
            ) : (
              <ClipboardDocumentIcon className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={handleEndSession}
            disabled={ending}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-medium transition-all"
          >
            <StopIcon className="w-4 h-4" />
            <span>{ending ? 'Ending...' : 'End Stream'}</span>
          </button>
        </div>
      </header>

      {/* Main Screen Stream Viewer */}
      <main className="flex-1 p-3 sm:p-6 flex flex-col justify-center items-center">
        <div className="w-full h-full max-w-6xl flex-1 flex flex-col justify-center items-center">
          <ScreenViewer
            stream={remoteStream}
            connectionState={connectionState}
            signalingState={signalingState}
            deviceName={deviceName}
            onRetry={() => {
              stopSharing();
              startViewing();
            }}
          />
        </div>
      </main>

      {/* Invite Modal */}
      <InvitationDialog
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        session={session}
      />
    </div>
  );
}
