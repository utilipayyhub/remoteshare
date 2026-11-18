'use client';

/**
 * InvitationDialog - Modal for sharing a session invitation link
 * via multiple channels (clipboard, WhatsApp, SMS, Email) with QR placeholder.
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  EnvelopeIcon,
  ChatBubbleLeftEllipsisIcon,
  LinkIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';

/**
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the dialog is visible
 * @param {function} props.onClose - Close handler
 * @param {object} props.session - Session data with invitation info
 */
export default function InvitationDialog({ isOpen, onClose, session }) {
  const [copied, setCopied] = useState(false);

  const invitationLink = session?.invitationLink ||
    (typeof window !== 'undefined' && session?.invitationToken
      ? `${window.location.origin}/invite/${session.invitationToken}`
      : '');

  const shareMessage = `I'd like to view your Android screen via RemoteView. Click here to start sharing: ${invitationLink}`;

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  /**
   * Copy invitation link to clipboard
   */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [invitationLink]);

  /**
   * Share via WhatsApp
   */
  const handleWhatsApp = useCallback(() => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, '_blank');
  }, [shareMessage]);

  /**
   * Share via SMS
   */
  const handleSMS = useCallback(() => {
    window.open(`sms:?body=${encodeURIComponent(shareMessage)}`, '_self');
  }, [shareMessage]);

  /**
   * Share via Email
   */
  const handleEmail = useCallback(() => {
    const subject = encodeURIComponent('RemoteView - Screen Sharing Invitation');
    const body = encodeURIComponent(shareMessage);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  }, [shareMessage]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Share invitation link"
          >
            <div className="glass-card w-full max-w-md p-6 shadow-2xl shadow-black/40" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                    <ShareIcon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-100">Share Invitation</h2>
                    <p className="text-xs text-gray-500">Send this link to the device owner</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.05] transition-colors"
                  aria-label="Close dialog"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Invitation link */}
              <div className="mb-6">
                <label className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2 block">
                  Invitation Link
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <LinkIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <span className="text-sm text-blue-300 font-mono truncate">
                      {invitationLink || 'Generating...'}
                    </span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`p-3 rounded-xl transition-all duration-200 flex-shrink-0 ${
                      copied
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25'
                    }`}
                    aria-label="Copy link to clipboard"
                  >
                    {copied ? <CheckIcon className="h-5 w-5" /> : <ClipboardDocumentIcon className="h-5 w-5" />}
                  </button>
                </div>
                {copied && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-emerald-400 mt-2"
                  >
                    ✓ Copied to clipboard!
                  </motion.p>
                )}
              </div>

              {/* Share buttons */}
              <div className="mb-6">
                <label className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3 block">
                  Share via
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={handleWhatsApp}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/15 hover:bg-emerald-500/15 transition-colors group"
                    aria-label="Share via WhatsApp"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-emerald-400" />
                    </div>
                    <span className="text-xs text-gray-400 font-medium">WhatsApp</span>
                  </button>

                  <button
                    onClick={handleSMS}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-500/[0.07] border border-blue-500/15 hover:bg-blue-500/15 transition-colors group"
                    aria-label="Share via SMS"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-blue-400" />
                    </div>
                    <span className="text-xs text-gray-400 font-medium">SMS</span>
                  </button>

                  <button
                    onClick={handleEmail}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-500/[0.07] border border-purple-500/15 hover:bg-purple-500/15 transition-colors group"
                    aria-label="Share via Email"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <EnvelopeIcon className="h-5 w-5 text-purple-400" />
                    </div>
                    <span className="text-xs text-gray-400 font-medium">Email</span>
                  </button>
                </div>
              </div>

              {/* QR Code placeholder */}
              <div className="mb-6">
                <label className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3 block">
                  QR Code
                </label>
                <div className="flex items-center justify-center p-6 rounded-xl bg-white/[0.03] border border-white/[0.06] border-dashed">
                  <div className="text-center">
                    <QrCodeIcon className="h-16 w-16 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">QR Code</p>
                    <p className="text-xs text-gray-600 mt-1">Scan to open invitation link</p>
                  </div>
                </div>
              </div>

              {/* Expiry info */}
              <div className="p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/10">
                <p className="text-xs text-amber-400/80">
                  <span className="font-semibold">⏱ Expires:</span>{' '}
                  {session?.expiresAt
                    ? new Date(session.expiresAt).toLocaleString()
                    : 'This link will expire after first use or in 24 hours.'}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Needed for the ShareIcon import — also used in the header
 */
function ShareIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
    </svg>
  );
}
