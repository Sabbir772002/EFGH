'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';

export default function PassengerLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'driver') {   // backend returns lowercase
        router.push('/driver/dashboard');
      }
    }
  }, [user, loading, router]);

  // Backend returns role as lowercase 'passenger' — never 'PASSENGER'
  if (loading || !user || user.role !== 'passenger') {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
