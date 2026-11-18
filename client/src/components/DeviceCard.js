'use client';

/**
 * DeviceCard - Displays device information in a glass-morphism card.
 * Shows device name, model, Android version, status, and last seen time.
 */

import { motion } from 'framer-motion';
import {
  DevicePhoneMobileIcon,
  TrashIcon,
  EyeIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';

/**
 * Calculate relative time string from a date
 * @param {string|Date} dateStr
 * @returns {string}
 */
function getRelativeTime(dateStr) {
  if (!dateStr) return 'Never';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

/**
 * Status dot color mapping
 * @param {'online'|'offline'|'sharing'} status
 */
function getStatusColor(status) {
  switch (status) {
    case 'online': return 'bg-emerald-500';
    case 'sharing': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
}

/**
 * @param {object} props
 * @param {object} props.device - Device data object
 * @param {function} [props.onRemove] - Handler for device removal
 * @param {function} [props.onViewDetails] - Handler for viewing details
 * @param {number} [props.index=0] - Animation index for staggered entry
 */
export default function DeviceCard({ device, onRemove, onViewDetails, index = 0 }) {
  const status = device.status || 'offline';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="glass-card-hover p-5 group"
    >
      <div className="flex items-start justify-between">
        {/* Device icon and info */}
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/10">
              <DevicePhoneMobileIcon className="h-6 w-6 text-blue-400" />
            </div>
            {/* Status dot */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${getStatusColor(status)} border-2 border-navy-950 ${status === 'online' || status === 'sharing' ? 'animate-pulse' : ''}`} />
          </div>

          <div className="min-w-0">
            <h3 className="font-semibold text-gray-100 truncate">
              {device.name || 'Unknown Device'}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {device.model || 'Unknown Model'}
              {device.androidVersion && ` · Android ${device.androidVersion}`}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`badge-${status}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(status)}`} />
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* Signal strength indicator */}
        {status === 'online' && (
          <SignalIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.05]">
        <span className="text-xs text-gray-600">
          Last seen: {getRelativeTime(device.lastSeen)}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(device)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
              aria-label={`View details for ${device.name}`}
            >
              <EyeIcon className="h-4 w-4" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(device)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              aria-label={`Remove ${device.name}`}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
