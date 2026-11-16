import { useState } from 'react'
import { money, shortDate } from '../../lib/format'

const W = 640, H = 220, L = 52, R = 12, T = 12, B = 26

// One line of net worth over time, with a hover crosshair and tooltip.
export function TrendChart({ points }: { points: { date: string; total: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)

  if (points.length < 2) {
    return <p className="muted small">Update balances on two different days and the trend line appears here.</p>
  }

  const totals = points.map((p) => p.total)
  const min = Math.min(...totals), max = Math.max(...totals)
  const pad = (max - min || Math.abs(max) || 1) * 0.1
  const lo = min - pad, hi = max + pad
  const x = (i: number) => L + (i * (W - L - R)) / (points.length - 1)
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const shown = hover ?? points.length - 1
  const grid = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3)
  const labelEvery = Math.ceil(points.length / 6)
  const compact = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Net worth from ${shortDate(points[0].date)} to ${shortDate(points[points.length - 1].date)}`}
        onMouseLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - box.left) / box.width) * W
          const i = Math.round(((px - L) / (W - L - R)) * (points.length - 1))
          setHover(Math.max(0, Math.min(points.length - 1, i)))
        }}
      >
        {grid.map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--line)" />
            <text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {compact(g)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={p.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {shortDate(p.date)}
            </text>
          ) : null,
        )}
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.total)}`).join(' ')}
          fill="none"
          stroke="var(--mark)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--muted)" strokeDasharray="3 3" />
        )}
        <circle cx={x(shown)} cy={y(points[shown].total)} r="5" fill="var(--mark)" stroke="var(--surface)" strokeWidth="2" />
      </svg>
      {hover !== null && (
        <div className="tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(points[hover].total) / H) * 100}%` }}>
          <b>{money(Math.round(points[hover].total))}</b> <span className="muted">{shortDate(points[hover].date)}</span>
        </div>
      )}
    </div>
  )
}
