'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  ArrowPathIcon,
  TvIcon,
  DevicePhoneMobileIcon,
  SignalIcon,
  ShieldCheckIcon,
  ClockIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import SessionCard from '@/components/SessionCard';
import DeviceCard from '@/components/DeviceCard';
import InvitationDialog from '@/components/InvitationDialog';
import {
  listSessionsAPI,
  createSessionAPI,
  endSessionAPI,
  listDevicesAPI,
  deleteDeviceAPI,
} from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Dialog state
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [creatingSession, setCreatingSession] = useState(false);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load dashboard data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoadingData(true);
    setRefreshing(true);
    setError(null);

    try {
      const [sessionsRes, devicesRes] = await Promise.allSettled([
        listSessionsAPI(),
        listDevicesAPI(),
      ]);

      if (sessionsRes.status === 'fulfilled' && sessionsRes.value) {
        setSessions(sessionsRes.value.sessions || []);
      }

      if (devicesRes.status === 'fulfilled' && devicesRes.value) {
        setDevices(devicesRes.value.devices || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to fetch latest dashboard data. Please try refreshing.');
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      // Auto-refresh every 12 seconds
      const interval = setInterval(() => {
        fetchData(true);
      }, 12000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchData]);

  // Create new session handler
  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      const res = await createSessionAPI();
      const newSession = res.session || res;
      // Prepend to session list
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSession(newSession);
      setIsInviteDialogOpen(true);
    } catch (err) {
      console.error('Failed to create session:', err);
      alert(err.message || 'Could not create new session. Please try again.');
    } finally {
      setCreatingSession(false);
    }
  };

  // End session handler
  const handleEndSession = async (sessionId) => {
    try {
      await endSessionAPI(sessionId);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, status: 'ended', endedAt: new Date().toISOString() } : s
        )
      );
    } catch (err) {
      console.error('Failed to end session:', err);
      alert(err.message || 'Could not end session.');
    }
  };

  // Share link dialog trigger
  const handleShareLink = (session) => {
    setCurrentSession(session);
    setIsInviteDialogOpen(true);
  };

  // Delete device handler
  const handleRemoveDevice = async (deviceId) => {
    if (!confirm('Are you sure you want to remove this device?')) return;
    try {
      await deleteDeviceAPI(deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch (err) {
      console.error('Failed to delete device:', err);
      alert(err.message || 'Could not remove device.');
    }
  };

  if (authLoading || (!isAuthenticated && typeof window !== 'undefined')) {
    return (
      <div className="min-h-screen bg-[#070b16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Authenticating RemoteView...</p>
        </div>
      </div>
    );
  }

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const pendingSessions = sessions.filter((s) => s.status === 'pending');
  const onlineDevices = devices.filter((d) => d.status === 'online' || d.status === 'sharing');

  return (
    <div className="min-h-screen bg-[#070b16] text-gray-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Welcome back, {user?.name || 'Viewer'}
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-cyan-400 border border-blue-500/20">
                PRO
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              Manage your remote screen sharing sessions and connected Android devices.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData()}
              disabled={refreshing}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh Dashboard"
            >
              <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <button
              onClick={handleCreateSession}
              disabled={creatingSession}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-blue-500/25 hover:shadow-cyan-500/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              <PlusIcon className="w-5 h-5 stroke-[2.5]" />
              <span>{creatingSession ? 'Creating...' : 'Start New Session'}</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-300 hover:text-white underline text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 relative overflow-hidden group hover:border-blue-500/30 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Live Streams
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <TvIcon className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {activeSessions.length}
              </span>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Now
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 relative overflow-hidden group hover:border-cyan-500/30 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Pending Invites
              </span>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                <ClockIcon className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {pendingSessions.length}
              </span>
              <span className="text-xs text-gray-400">Waiting for devices</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 relative overflow-hidden group hover:border-emerald-500/30 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Android Devices
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <DevicePhoneMobileIcon className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {devices.length}
              </span>
              <span className="text-xs text-emerald-400">
                {onlineDevices.length} online
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 relative overflow-hidden group hover:border-purple-500/30 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Security & Signaling
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                <ShieldCheckIcon className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-400 tracking-tight">
                Encrypted
              </span>
              <span className="text-xs text-gray-400">SRTP + TLS</span>
            </div>
          </motion.div>
        </div>

        {/* Sessions Section */}
        <section id="sessions" className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold text-white">Screen Sharing Sessions</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Active streaming sessions and generated invitation links
              </p>
            </div>
          </div>

          {loadingData ? (
            <div className="p-12 text-center bg-white/[0.02] rounded-2xl border border-white/5">
              <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Loading sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center bg-gradient-to-b from-white/[0.04] to-white/[0.01] rounded-2xl border border-white/10">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-4">
                <TvIcon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">No sessions yet</h3>
              <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
                Click &ldquo;Start New Session&rdquo; to generate a secure invitation link and share your screen with any Android device.
              </p>
              <button
                onClick={handleCreateSession}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Create First Session</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <AnimatePresence>
                {sessions.map((session, idx) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    index={idx}
                    onEndSession={() => handleEndSession(session.id)}
                    onShareLink={() => handleShareLink(session)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Connected Android Devices Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold text-white">Registered Android Devices</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Android phones and tablets that have connected to your platform
              </p>
            </div>
          </div>

          {loadingData ? (
            <div className="p-12 text-center bg-white/[0.02] rounded-2xl border border-white/5">
              <div className="w-8 h-8 border-3 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Loading devices...</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="p-10 text-center bg-gradient-to-b from-white/[0.04] to-white/[0.01] rounded-2xl border border-white/10">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-3">
                <DevicePhoneMobileIcon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">No registered devices</h3>
              <p className="text-gray-400 text-xs max-w-sm mx-auto">
                When an Android owner opens your invitation link and accepts screen sharing, their device will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <AnimatePresence>
                {devices.map((device, idx) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    index={idx}
                    onRemove={() => handleRemoveDevice(device.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      {/* Invitation Modal Dialog */}
      <InvitationDialog
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        session={currentSession}
      />
    </div>
  );
}
