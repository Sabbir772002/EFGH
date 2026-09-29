// Spinner — inline loading indicator (CSS border-based, no image deps)
// Used inside Button (loading), Spinner full-page, and any async state.

interface SpinnerProps {
  size?: number;   // px, default 24
  color?: string;  // default var(--accent)
}

export default function Spinner({ size = 24, color = 'var(--accent)' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `${Math.max(2, size / 8)}px solid rgba(255,255,255,0.12)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}
