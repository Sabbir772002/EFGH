'use client';

// components/Providers.tsx
// Client-side provider wrapper for root layout.
// Root layout is a Server Component, so all providers that need client APIs
// (context, SWR) must be extracted to a 'use client' boundary like this.

import React from 'react';
import { SWRConfig } from 'swr';
import { AuthProvider } from '@/context/AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SWRConfig
        value={{
          // Revalidate on window focus for live data freshness
          revalidateOnFocus: true,
          // Retry failed requests up to 2 times
          errorRetryCount: 2,
          // Deduplicate requests within 2 seconds
          dedupingInterval: 2000,
        }}
      >
        {children}
      </SWRConfig>
    </AuthProvider>
  );
}
