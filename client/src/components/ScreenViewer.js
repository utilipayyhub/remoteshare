'use client';

import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  VideoCameraSlashIcon,
  SignalIcon,
  ArrowPathIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline';

/**
 * ScreenViewer - Premium real-time screen stream renderer.
 * Handles video stream binding, full-screen toggle, orientation handling,
 * and loading / connection states.
 *
 * @param {object} props
 * @param {MediaStream|null} props.stream - Live media stream from WebRTC
 * @param {string} props.connectionState - WebRTC connection state ('new'|'connecting'|'connected'|'disconnected'|'failed')
 * @param {string} props.signalingState - WebSocket signaling state ('connected'|'disconnected')
 * @param {string} [props.deviceName] - Name of the remote Android device
 * @param {function} [props.onRetry] - Optional retry handler
 */
export default function ScreenViewer({
  stream,
  connectionState,
  signalingState,
  deviceName = 'Android Device',
  onRetry,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(true);

  // Attach media stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      video.play().catch((err) => {
        console.warn('Autoplay prevented:', err);
      });
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  };

  const isConnected = connectionState === 'connected' && stream;
  const isConnecting = connectionState === 'connecting' || (connectionState === 'connected' && !stream);
  const isFailed = connectionState === 'failed' || connectionState === 'disconnected';

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-[#050811] flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : 'min-h-[500px]'
      }`}
    >
      {/* Background ambient glow */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/20 blur-[100px] rounded-full" />
      </div>

      {/* Top Overlay bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 pointer-events-auto">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected
                  ? 'bg-emerald-500 animate-pulse'
                  : isConnecting
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-200">
              {isConnected ? 'LIVE' : isConnecting ? 'CONNECTING' : 'DISCONNECTED'}
            </span>
          </div>

          <div className="w-px h-3 bg-white/20" />

          <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
            <DevicePhoneMobileIcon className="w-3.5 h-3.5 text-blue-400" />
            <span>{deviceName}</span>
          </div>
        </div>

        {/* View / Aspect Ratio & Fullscreen Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setIsPortrait((prev) => !prev)}
            className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs text-gray-300 hover:text-white transition-colors"
            title="Toggle Phone / Widescreen aspect ratio"
          >
            <DevicePhoneMobileIcon className={`w-3.5 h-3.5 ${isPortrait ? 'rotate-0 text-cyan-400' : 'rotate-90'}`} />
            <span>{isPortrait ? 'Phone (9:16)' : 'Widescreen (16:9)'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full border border-white/10 text-gray-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="w-4 h-4" />
            ) : (
              <ArrowsPointingOutIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Video Display Container */}
      <div
        className={`relative transition-all duration-300 flex items-center justify-center max-w-full max-h-full ${
          isPortrait ? 'aspect-[9/19] h-[90%] max-h-[800px]' : 'aspect-video w-[90%] max-w-[1200px]'
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain rounded-xl bg-black/90 shadow-2xl transition-all duration-300 ${
            isConnected ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        />

        {/* Phone Frame Mockup when Portrait & Connected */}
        {isPortrait && isConnected && (
          <div className="absolute inset-0 pointer-events-none rounded-xl border-2 border-white/20 shadow-inner" />
        )}

        {/* State: Connecting / Waiting */}
        {isConnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#070b16]/90 backdrop-blur-sm rounded-xl border border-white/5">
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
              <DevicePhoneMobileIcon className="w-7 h-7 text-blue-400 absolute inset-0 m-auto" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Connecting to Android Device...</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-4">
              Waiting for the device owner to accept the invitation and allow screen capture permissions.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">
              <SignalIcon className="w-3.5 h-3.5 animate-pulse" />
              <span>Signaling: {signalingState}</span>
            </div>
          </div>
        )}

        {/* State: Failed / Disconnected */}
        {isFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#070b16]/95 backdrop-blur-sm rounded-xl border border-rose-500/20">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-400">
              <VideoCameraSlashIcon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Screen Stream Disconnected</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">
              The remote Android device ended screen sharing or lost network connection.
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
              >
                <ArrowPathIcon className="w-4 h-4" />
                <span>Reconnect Stream</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Subtle bottom info bar */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-gray-400 pointer-events-none">
        <span className="bg-black/40 px-2.5 py-1 rounded-md border border-white/5">
          End-to-End Encrypted WebRTC Peer Connection
        </span>
        <span className="bg-black/40 px-2.5 py-1 rounded-md border border-white/5">
          Adaptive 1080p/720p 60fps Stream
        </span>
      </div>
    </div>
  );
}
