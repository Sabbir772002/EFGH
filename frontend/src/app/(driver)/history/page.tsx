'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { swrFetcher } from '@/lib/api';
import { Pool } from '@/lib/types';
import { formatBDT } from '@/lib/constants';
import Link from 'next/link';

export default function DriverHistoryPage() {
  const { data: pools, isLoading } = useSWR<Pool[]>('/pools/history', swrFetcher);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredPools = (pools || []).filter((p) => {
    if (filterStatus === 'ALL') return true;
    return p.status === filterStatus.toLowerCase();
  });

  return (
    <div style={{ padding: '1rem 0', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Driver Pool History</h1>
          <p style={{ color: 'var(--muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            All past completed and cancelled pool runs
          </p>
        </div>

        <Link href="/driver/dashboard">
          <Button variant="outline">← Cockpit</Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['ALL', 'COMPLETED', 'CANCELLED'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              border: `1px solid ${filterStatus === status ? 'var(--accent)' : 'var(--border)'}`,
              background: filterStatus === status ? 'rgba(245, 197, 24, 0.15)' : 'var(--surface)',
              color: filterStatus === status ? 'var(--accent)' : 'var(--muted)',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            {status}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><Spinner size="lg" /></div>
        ) : filteredPools.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
            No pools found matching selected filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredPools.map((pool) => {
              const rides = pool.ride_requests || [];
              const totalEarningsPaisa = rides.reduce((sum, r) => sum + (r.fare_paisa || 0), 0);

              return (
                <div
                  key={pool.id}
                  style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                        Route: {pool.route?.name || 'Route'}
                      </span>
                      <Badge variant={pool.status === 'completed' ? 'success' : pool.status === 'cancelled' ? 'danger' : 'accent'}>
                        {pool.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                      Origin: {pool.origin_stop?.name} → Destination: {pool.dest_stop?.name}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                      Date: {new Date(pool.created_at).toLocaleString()} • {rides.length} Passenger{rides.length > 1 ? 's' : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>
                        {formatBDT(totalEarningsPaisa)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Total Earnings</div>
                    </div>

                    <Link href={`/driver/pool/${pool.id}`}>
                      <Button variant="outline" size="sm">
                        View Pool →
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
