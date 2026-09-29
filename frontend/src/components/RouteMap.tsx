// components/RouteMap.tsx
// Interactive SVG map of all 4 Dhaka Tesla Pool routes.
//
// Features:
//  - 4 colour-coded route polylines (yellow, blue, green, red)
//  - 26 stop circles at real lat/lng positions
//  - Click stop 1 → pickup (green pulsing ring)
//  - Click stop 2 → dropoff (red ring)
//  - Shared segment between pickup→dropoff on the active route highlights in yellow
//  - Hover shows stop name tooltip
//  - Passes back real Stop objects (with DB UUID) to parent
//
// Stop name matching: the component uses static topology (names) and maps
// them to the API Stop objects received via props to get the real DB IDs.

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { Stop } from '@/lib/types';

// ── Static route topology (must match seed data names exactly) ────────────

const ROUTE_TOPOLOGY = [
  {
    key: 'r1',
    label: 'Route 1 — Bijoy Sarani → Kuril Flyover',
    color: '#f5c518',
    stopNames: [
      'Bijoy Sarani', 'Old Airport', 'Jahangir Gate', 'Mohakhali',
      'Chairman Bari', 'Sainik Club', 'Banani', 'Staff Road',
      'MES', 'Shewra', 'Kuril Flyover',
    ],
  },
  {
    key: 'r2',
    label: 'Route 2 — Mohakhali → Badda Link Road',
    color: '#58a6ff',
    stopNames: [
      'Mohakhali', 'Amtoli (Mohakhali)', 'Wireless',
      'Gulshan Bridge', 'Gulshan 1', 'Badda Link Road',
    ],
  },
  {
    key: 'r3',
    label: 'Route 3 — Badda Link Road → Kuril Flyover',
    color: '#3fb950',
    stopNames: [
      'Badda Link Road', 'Badda', 'Uttar Badda', 'Shahjadpur',
      'Bashtola', 'Notun Bazar', 'Coca Cola Bus Stop', 'Nadda',
      'Bashundhara', 'Jamuna Future Park', 'Kuril Flyover',
    ],
  },
  {
    key: 'r4',
    label: 'Route 4 — Banani → Notun Bazar',
    color: '#f85149',
    stopNames: ['Banani', 'Gulshan 2', 'Notun Bazar'],
  },
];

// ── SVG coordinate mapping ─────────────────────────────────────────────────

const SVG_W = 800;
const SVG_H = 520;
const PAD = 44;

// Geographic bounds (slightly extended beyond stop extremes for visual margin)
const LAT_MAX = 23.824;
const LAT_MIN = 23.762;
const LNG_MIN = 90.387;
const LNG_MAX = 90.428;

/** Convert real-world lat/lng to SVG x/y pixel position. */
function toSVG(lat: number, lng: number): [number, number] {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * (SVG_W - 2 * PAD) + PAD;
  // y is inverted: higher lat = smaller y (north is up)
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (SVG_H - 2 * PAD) + PAD;
  return [Math.round(x), Math.round(y)];
}

// ── Helper: find highlighted segment ──────────────────────────────────────

/**
 * Given a route and two selected stops, return the list of [x,y] pairs
 * for the segment polyline between them (inclusive). Returns [] if either
 * stop is not on the route or they're in wrong order.
 */
function getHighlightedSegment(
  route: (typeof ROUTE_TOPOLOGY)[number],
  stopMap: Map<string, Stop>,
  pickup: Stop | null,
  dropoff: Stop | null,
): Array<[number, number]> {
  if (!pickup || !dropoff) return [];

  const idxPickup = route.stopNames.indexOf(pickup.name);
  const idxDropoff = route.stopNames.indexOf(dropoff.name);

  if (idxPickup === -1 || idxDropoff === -1 || idxPickup >= idxDropoff) return [];

  return route.stopNames.slice(idxPickup, idxDropoff + 1).map((name) => {
    const s = stopMap.get(name);
    return s ? toSVG(s.lat, s.lng) : [0, 0] as [number, number];
  });
}

// ── Props ─────────────────────────────────────────────────────────────────

interface RouteMapProps {
  /** All stops from the API (used to get real UUIDs and coordinates). */
  stops: Stop[];
  /** Currently selected pickup stop (controlled by parent). */
  pickup: Stop | null;
  /** Currently selected dropoff stop (controlled by parent). */
  dropoff: Stop | null;
  /**
   * Called when user clicks a stop circle.
   * Parent decides whether to set it as pickup or dropoff.
   */
  onStopClick: (stop: Stop) => void;
  /**
   * Route key ('r1'–'r4') to highlight the segment on.
   * If null, no segment is highlighted.
   */
  activeRouteKey?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function RouteMap({
  stops,
  pickup,
  dropoff,
  onStopClick,
  activeRouteKey = null,
}: RouteMapProps) {
  const [hoveredStop, setHoveredStop] = useState<string | null>(null); // stop name

  // Build a name → Stop map for fast lookup
  const stopMap = useMemo(() => {
    const m = new Map<string, Stop>();
    stops.forEach((s) => m.set(s.name, s));
    return m;
  }, [stops]);

  // Build route polyline point strings
  const routeLines = useMemo(() =>
    ROUTE_TOPOLOGY.map((route) => {
      const points = route.stopNames
        .map((name) => {
          const s = stopMap.get(name);
          if (!s) return null;
          const [x, y] = toSVG(s.lat, s.lng);
          return `${x},${y}`;
        })
        .filter(Boolean)
        .join(' ');
      return { ...route, points };
    }), [stopMap]);

  // Highlighted segment (between pickup and dropoff on the active route)
  const highlightPoints = useMemo(() => {
    if (!activeRouteKey) return '';
    const route = ROUTE_TOPOLOGY.find((r) => r.key === activeRouteKey);
    if (!route) return '';
    const seg = getHighlightedSegment(route, stopMap, pickup, dropoff);
    return seg.map(([x, y]) => `${x},${y}`).join(' ');
  }, [activeRouteKey, stopMap, pickup, dropoff]);

  // Unique stops to render (de-duplicated by name, since some stops appear on multiple routes)
  const uniqueStops = useMemo(() => {
    const seen = new Set<string>();
    const out: Stop[] = [];
    stops.forEach((s) => {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        out.push(s);
      }
    });
    return out;
  }, [stops]);

  const handleStopClick = useCallback(
    (stop: Stop) => {
      onStopClick(stop);
    },
    [onStopClick],
  );

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        {ROUTE_TOPOLOGY.map((r) => (
          <div
            key={r.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.72rem',
              color: 'var(--muted)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 20,
                height: 3,
                background: r.color,
                borderRadius: 2,
                opacity: activeRouteKey && activeRouteKey !== r.key ? 0.3 : 1,
              }}
            />
            {r.label.split(' — ')[0]}
          </div>
        ))}
      </div>

      {/* SVG map */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{
          width: '100%',
          height: 'auto',
          background: 'var(--surface2)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          display: 'block',
        }}
        role="img"
        aria-label="Dhaka Tesla Pool route map — click stops to select pickup and dropoff"
      >
        {/* Subtle grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="var(--border)"
              strokeWidth="0.4"
              opacity="0.3"
            />
          </pattern>
        </defs>
        <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />

        {/* Route polylines (draw dimmed first, then active on top) */}
        {routeLines.map((route) => {
          const isDimmed = !!activeRouteKey && activeRouteKey !== route.key;
          return (
            <polyline
              key={route.key}
              points={route.points}
              fill="none"
              stroke={route.color}
              strokeWidth={isDimmed ? 1.5 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isDimmed ? 0.2 : 0.7}
            />
          );
        })}

        {/* Highlighted segment (pickup→dropoff) */}
        {highlightPoints && (
          <polyline
            points={highlightPoints}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        )}

        {/* Stop circles */}
        {uniqueStops.map((stop) => {
          const [x, y] = toSVG(stop.lat, stop.lng);
          const isPickup = pickup?.id === stop.id;
          const isDropoff = dropoff?.id === stop.id;
          const isHovered = hoveredStop === stop.name;

          return (
            <g
              key={stop.id}
              onClick={() => handleStopClick(stop)}
              onMouseEnter={() => setHoveredStop(stop.name)}
              onMouseLeave={() => setHoveredStop(null)}
              style={{ cursor: 'pointer' }}
              role="button"
              aria-label={`Stop: ${stop.name}`}
            >
              {/* Pickup pulse ring */}
              {isPickup && (
                <circle
                  cx={x}
                  cy={y}
                  r={14}
                  fill="none"
                  stroke="#3fb950"
                  strokeWidth={2}
                  opacity={0.6}
                  style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
                />
              )}

              {/* Dropoff outer ring */}
              {isDropoff && (
                <circle
                  cx={x}
                  cy={y}
                  r={12}
                  fill="none"
                  stroke="var(--danger)"
                  strokeWidth={2}
                  opacity={0.8}
                />
              )}

              {/* Hover ring */}
              {isHovered && !isPickup && !isDropoff && (
                <circle
                  cx={x}
                  cy={y}
                  r={10}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth={1.5}
                  opacity={0.6}
                />
              )}

              {/* Main stop dot */}
              <circle
                cx={x}
                cy={y}
                r={isPickup || isDropoff ? 7 : 5}
                fill={
                  isPickup
                    ? '#3fb950'
                    : isDropoff
                    ? 'var(--danger)'
                    : isHovered
                    ? 'var(--text)'
                    : 'var(--surface)'
                }
                stroke={isPickup || isDropoff ? 'none' : 'var(--border)'}
                strokeWidth={1.5}
              />

              {/* Stop name label (shown on hover or when selected) */}
              {(isHovered || isPickup || isDropoff) && (
                <text
                  x={x}
                  y={y - 14}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily="var(--font)"
                  fontWeight={600}
                  fill={
                    isPickup ? '#3fb950' : isDropoff ? 'var(--danger)' : 'var(--text)'
                  }
                >
                  {stop.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Pickup / Dropoff legend inside SVG */}
        {(pickup || dropoff) && (
          <g>
            <rect
              x={SVG_W - 190}
              y={SVG_H - 68}
              width={178}
              height={58}
              rx={8}
              fill="var(--surface)"
              opacity={0.92}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={SVG_W - 101}
              y={SVG_H - 50}
              textAnchor="middle"
              fontSize={9}
              fontFamily="var(--font)"
              fill="var(--muted)"
              fontWeight={600}
              textDecoration="uppercase"
              letterSpacing="0.08em"
            >
              SELECTION
            </text>
            <circle cx={SVG_W - 181} cy={SVG_H - 32} r={5} fill="#3fb950" />
            <text
              x={SVG_W - 172}
              y={SVG_H - 28}
              fontSize={9.5}
              fontFamily="var(--font)"
              fill="var(--text2)"
            >
              {pickup ? pickup.name : 'Click to set pickup'}
            </text>
            <circle cx={SVG_W - 181} cy={SVG_H - 16} r={5} fill="var(--danger)" />
            <text
              x={SVG_W - 172}
              y={SVG_H - 12}
              fontSize={9.5}
              fontFamily="var(--font)"
              fill="var(--text2)"
            >
              {dropoff ? dropoff.name : 'Click to set dropoff'}
            </text>
          </g>
        )}
      </svg>

      {/* Instruction text */}
      <p
        style={{
          marginTop: '0.5rem',
          fontSize: '0.78rem',
          color: 'var(--muted)',
          textAlign: 'center',
        }}
      >
        {!pickup
          ? '① Click a stop to set your pickup'
          : !dropoff
          ? '② Click another stop to set your dropoff'
          : '✓ Both stops selected — or click to reset and reselect'}
      </p>
    </div>
  );
}
