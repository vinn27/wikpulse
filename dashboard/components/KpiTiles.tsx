"use client";

// Stat tiles per the tile contract: label · value (proportional figures) ·
// optional signed delta vs a named period · optional 12-point sparkline
// (de-emphasis hue, current point in the accent).
import { fmtInt } from "@/lib/dashboard";

export type Tile = {
  label: string;
  value: string;
  sub?: string;
  hint?: string; // plain-language definition, shown on hover
  delta?: number; // absolute change vs previous period
  deltaPct?: number;
  upIsGood?: boolean;
  spark?: number[];
};

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 120;
  const h = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (w - 8) + 4;
    const y = h - 4 - ((p - min) / span) * (h - 8);
    return [x, y] as const;
  });
  const last = xy[xy.length - 1];
  return (
    <svg width={w} height={h} aria-hidden="true">
      <polyline
        points={xy.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="var(--baseline)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill="var(--accent)" stroke="#fff" strokeWidth={2} />
    </svg>
  );
}

export default function KpiTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => {
        const up = (t.delta ?? 0) >= 0;
        const good = t.upIsGood === undefined ? up : up === t.upIsGood;
        return (
          <div key={t.label} className="tile tile-hover px-4 py-3.5" title={t.hint}>
            <div
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide"
              style={{ color: "var(--ink-2)" }}
            >
              {t.label}
              {t.hint && (
                <span aria-hidden="true" style={{ color: "var(--muted)" }} title={t.hint}>
                  ⓘ
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <div>
                <div className="text-[28px] font-semibold leading-8 tracking-tight">{t.value}</div>
                {t.delta !== undefined && (
                  <div
                    className="mt-0.5 text-xs"
                    style={{ color: good ? "var(--good)" : "#d03b3b" }}
                  >
                    {up ? "▲" : "▼"} {fmtInt(Math.abs(t.delta))}
                    {t.deltaPct !== undefined && ` (${t.deltaPct >= 0 ? "+" : ""}${t.deltaPct.toFixed(1)}%)`}
                    <span style={{ color: "var(--muted)" }}> {t.sub}</span>
                  </div>
                )}
                {t.delta === undefined && t.sub && (
                  <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                    {t.sub}
                  </div>
                )}
              </div>
              {t.spark && <Sparkline points={t.spark} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
