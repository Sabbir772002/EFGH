// Badge — color-coded status pill.
// Accepts any ride/pool status string and maps it to the right colour class
// defined in globals.css (.status-*).
// Also accepts explicit variant: success | warning | danger | info | default.

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'default';

// Known status strings from the backend enums.
type RideStatus =
  | 'requested'
  | 'matched'
  | 'driver_arrived'
  | 'started'
  | 'completed'
  | 'cancelled';

type PoolStatus = 'open' | 'full' | 'driver_arrived' | 'started' | 'completed' | 'cancelled';

type BadgeStatus = RideStatus | PoolStatus | string;

interface BadgeProps {
  status?: BadgeStatus;   // uses .status-* class from globals.css
  variant?: Variant;      // explicit override
  children: React.ReactNode;
  style?: React.CSSProperties;
}

// Explicit variant styles — used when status prop is not provided.
const variantStyles: Record<Variant, React.CSSProperties> = {
  success: { color: 'var(--success)', background: 'rgba(63,185,80,0.12)' },
  warning: { color: 'var(--warning)', background: 'rgba(210,153,34,0.12)' },
  danger:  { color: 'var(--danger)',  background: 'rgba(248,81,73,0.12)' },
  info:    { color: 'var(--accent2)', background: 'rgba(88,166,255,0.12)' },
  default: { color: 'var(--muted)',   background: 'rgba(139,148,158,0.12)' },
};

export default function Badge({ status, variant, children, style }: BadgeProps) {
  // If status given, use the .status-{status} class from globals.css.
  // If variant given, use inline styles for the colour pair.
  const className = status ? `status-${status}` : undefined;
  const inlineStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.2rem 0.65rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
    // If no status class, fall back to variant or default.
    ...(variant && !status ? variantStyles[variant] : {}),
    ...style,
  };

  return (
    <span className={className} style={inlineStyle}>
      {children}
    </span>
  );
}
