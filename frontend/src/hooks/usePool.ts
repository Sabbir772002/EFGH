// hooks/usePool.ts
// SWR data hook for a single pool (driver pool detail page).
// SWR revalidates on focus and every 5s — driver pages are high-frequency.

'use client';

import useSWR from 'swr';
import { swrFetcher } from '@/lib/api';
import { API } from '@/lib/constants';
import type { Pool } from '@/lib/types';

interface UsePoolResult {
  pool: Pool | null;
  isLoading: boolean;
  error: unknown;
  refresh: () => void;
}

export function usePool(poolId: string | null): UsePoolResult {
  const swrKey = poolId ? `/pools/${poolId}` : null;

  const { data, error, isLoading, mutate } = useSWR<Pool>(swrKey, swrFetcher, {
    revalidateOnFocus: true,
    refreshInterval: 5_000,
  });

  return {
    pool: data ?? null,
    isLoading,
    error,
    refresh: () => mutate(),
  };
}
