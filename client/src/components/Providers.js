'use client';

/**
 * Providers - Client component wrapper for all context providers.
 * Used in the root layout to wrap children with necessary providers.
 */

import { AuthProvider } from '@/contexts/AuthContext';

export default function Providers({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
