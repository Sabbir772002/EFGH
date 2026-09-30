// Landing page placeholder — Phase 8 scaffold.
// Full landing with cast cards and role selector built in Phase 9.
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dhaka Tesla Pool — Real-time Carpooling',
};

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      {/* Logo / brand mark */}
      <div>
        <span
          style={{
            fontSize: '3rem',
            fontWeight: 800,
            color: 'var(--accent)',
            letterSpacing: '-0.04em',
          }}
        >
          ⚡ Dhaka Tesla Pool
        </span>
        <p className="text-muted mt-2" style={{ fontSize: '1.1rem' }}>
          Real-time carpooling across Dhaka
        </p>
      </div>

      {/* Role selector */}
      <div className="flex gap-4 flex-wrap" style={{ justifyContent: 'center' }}>
        <Link
          href="/login"
          id="cta-passenger"
          style={{
            padding: '0.9rem 2.5rem',
            background: 'var(--accent)',
            color: '#0d1117',
            fontWeight: 700,
            fontSize: '1rem',
            borderRadius: 'var(--radius)',
            transition: 'opacity 180ms ease',
          }}
        >
          Login
        </Link>
        <Link
          href="/register"
          id="cta-register"
          style={{
            padding: '0.9rem 2.5rem',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontWeight: 600,
            fontSize: '1rem',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            transition: 'border-color 180ms ease',
          }}
        >
          Register
        </Link>
      </div>

      {/* Quick route hint */}
      <p className="text-muted text-sm">
        Bijoy Sarani → Kuril Flyover · Banani → Notun Bazar · and more
      </p>
    </main>
  );
}
