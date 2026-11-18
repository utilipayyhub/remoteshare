/**
 * Root Layout - Server component for RemoteView application.
 * Sets up HTML structure, fonts, metadata, and wraps children with Providers.
 */

import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'RemoteView - Remote Android Screen Sharing',
  description: 'Share your Android screen securely with anyone, anywhere in the world. Real-time, low-latency screen sharing powered by WebRTC.',
  keywords: ['android', 'screen sharing', 'remote view', 'webrtc', 'real-time'],
  authors: [{ name: 'RemoteView' }],
  openGraph: {
    title: 'RemoteView - Remote Android Screen Sharing',
    description: 'Share your Android screen securely with anyone, anywhere in the world.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-navy-950 text-gray-100 font-sans antialiased min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
