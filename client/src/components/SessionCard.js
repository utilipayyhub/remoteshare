'use client';

/**
 * SessionCard - Displays a session with status, timing, device info, and action buttons.
 * Includes a live duration counter for active sessions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  EyeIcon,
  StopIcon,
  ClipboardDocumentIcon,
  ShareIcon,
  ClockIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

/**
 * Format seconds into HH:MM:SS or MM:SS
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Truncate a session ID for display
 * @param {string} id
 * @returns {string}
 */
function truncateId(id) {
  if (!id) return '—';
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

/**
 * @param {object} props
 * @param {object} props.session - Session data object
 * @param {function} [props.onEndSession] - Handler for ending the session
 * @param {function} [props.onShareLink] - Handler for sharing invitation link
 * @param {number} [props.index=0] - Animation index
 */
export default function SessionCard({ session, onEndSession, onShareLink, index = 0 }) {
  const router = useRouter();
  const [duration, setDuration] = useState(0);
  const [copied, setCopied] = useState(false);

  const status = session.status || 'pending';
  const isActive = status === 'active';
  const isPending = status === 'pending';
  const isEnded = status === 'ended';

  // Live duration counter for active sessions
  useEffect(() => {
    if (!isActive || !session.startedAt) return;

    const startTime = new Date(session.startedAt).getTime();

    const updateDuration = () => {
      const now = Date.now();
      setDuration(Math.floor((now - startTime) / 1000));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [isActive, session.startedAt]);

  // Calculate duration for ended sessions
  useEffect(() => {
    if (isEnded && session.startedAt && session.endedAt) {
      const start = new Date(session.startedAt).getTime();
      const end = new Date(session.endedAt).getTime();
      setDuration(Math.floor((end - start) / 1000));
    }
  }, [isEnded, session.startedAt, session.endedAt]);

  /**
   * Copy invitation link to clipboard
   */
  const handleCopyLink = useCallback(async () => {
    const link = session.invitationLink || `${window.location.origin}/invite/${session.invitationToken}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }, [session.invitationLink, session.invitationToken]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="glass-card-hover p-5"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isActive
              ? 'bg-emerald-500/15 border border-emerald-500/20'
              : isPending
                ? 'bg-amber-500/15 border border-amber-500/20'
                : 'bg-gray-500/15 border border-gray-500/20'
          }`}>
            {isActive ? (
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            ) : isPending ? (
              <ClockIcon className="h-5 w-5 text-amber-400" />
            ) : (
              <StopIcon className="h-5 w-5 text-gray-500" />
            )}
          </div>
          <div>
            <p className="text-sm font-mono text-gray-400">{truncateId(session._id || session.id)}</p>
            <span className={`badge-${status}`}>{status}</span>
          </div>
        </div>

        {/* Duration */}
        {(isActive || isEnded) && (
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Duration</p>
            <p className={`text-lg font-mono font-semibold ${isActive ? 'text-emerald-400' : 'text-gray-400'}`}>
              {formatDuration(duration)}
            </p>
          </div>
        )}
      </div>

      {/* Device info */}
      {session.device && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] mb-3">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-sm text-gray-300">{session.device.name || 'Connected Device'}</span>
          {session.device.model && (
            <span className="text-xs text-gray-500">({session.device.model})</span>
          )}
        </div>
      )}

      {/* Invitation link for pending sessions */}
      {isPending && session.invitationToken && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/[0.06] border border-blue-500/10 mb-3">
          <input
            type="text"
            readOnly
            value={session.invitationLink || `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${session.invitationToken}`}
            className="flex-1 bg-transparent text-xs text-blue-300 font-mono outline-none truncate"
            aria-label="Invitation link"
          />
          <button
            onClick={handleCopyLink}
            className="p-1 rounded text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
            aria-label="Copy invitation link"
          >
            {copied ? (
              <CheckIcon className="h-4 w-4 text-emerald-400" />
            ) : (
              <ClipboardDocumentIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.05]">
        {isActive && (
          <>
            <button
              onClick={() => router.push(`/session/${session._id || session.id}`)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
            >
              <EyeIcon className="h-4 w-4" />
              View Screen
            </button>
            <button
              onClick={() => onEndSession && onEndSession(session._id || session.id)}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
            >
              <StopIcon className="h-4 w-4" />
              End
            </button>
          </>
        )}

        {isPending && (
          <>
            <button
              onClick={handleCopyLink}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors"
            >
              {copied ? <CheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={() => onShareLink && onShareLink(session)}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
            >
              <ShareIcon className="h-4 w-4" />
              Share
            </button>
            <button
              onClick={() => onEndSession && onEndSession(session._id || session.id)}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-400 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] transition-colors"
            >
              <StopIcon className="h-4 w-4" />
              Cancel
            </button>
          </>
        )}

        {isEnded && (
          <span className="text-xs text-gray-600">
            Ended {session.endedAt ? new Date(session.endedAt).toLocaleString() : ''}
          </span>
        )}
      </div>
    </motion.div>
  );
}
