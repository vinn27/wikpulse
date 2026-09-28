"use client";

// Main trend visual: stacked human+bot edits, thin rounded-end bars,
// 2px surface gaps between segments, hairline grid, PBI-style tooltip
// (values lead, line keys), click-to-cross-filter on a whole column.
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { bucketLabel, editsFor, fmtCompact, fmtInt, fullLabel, type Audience, type Grain, type Row } from "@/lib/dashboard";

type TipEntry = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: unknown;
};

function PbiTooltip({
  active,
  payload,
  label,
  grain,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TipEntry>;
  label?: string | number;
  grain: Grain;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as Row | undefined; // recharts injects the source row here
  const lines = [
    { key: "Human", color: "var(--series-human)", value: row?.human ?? 0 },
    { key: "Bots", color: "var(--series-bot)", value: row?.bot ?? 0 },
    { key: "Total", color: "var(--baseline)", value: row?.edits ?? 0 },
  ];
  return (
    <div className="tile px-3 py-2 text-xs shadow-lg" style={{ minWidth: 150 }}>
      <div className="mb-1 font-medium" style={{ color: "var(--ink-2)" }}>
        {typeof label === "string" ? fullLabel(label, grain) : String(label)}
      </div>
      {lines.map((l) => (
        <div key={l.key} className="flex items-center gap-2 py-0.5">
          <span
            aria-hidden="true"
            style={{ display: "inline-block", width: 10, height: 2, background: l.color, borderRadius: 1 }}
          />
          <span className="flex-1" style={{ color: "var(--ink-2)" }}>
            {l.key}
          </span>
          <span className="font-semibold">{fmtInt(l.value)}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-2 border-t pt-1" style={{ borderColor: "var(--grid)" }}>
        <span className="flex-1" style={{ color: "var(--ink-2)" }}>
          Unique editors
        </span>
        <span className="font-semibold">{fmtInt(row?.editors ?? 0)}</span>
      </div>
    </div>
  );
}

export default function TrendChart({
  rows,
  grain,
  audience,
  height = 300,
  selectedLabel,
  onBucketClick,
}: {
  rows: Row[];
  grain: Grain;
  audience: Audience;
  height?: number;
  selectedLabel?: string | null;
  onBucketClick?: (row: Row) => void;
}) {
  const showHuman = audience !== "bot";
  const showBot = audience !== "human";

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          onClick={(s: unknown) => {
            const st = s as { activePayload?: ReadonlyArray<{ payload?: Row }> };
            const row = st.activePayload?.[0]?.payload;
            if (row && onBucketClick) onBucketClick(row);
          }}
        >
          <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
          <XAxis
            dataKey="t"
            tickFormatter={(v: string) => bucketLabel(v, grain)}
            tickLine={false}
            axisLine={{ stroke: "var(--baseline)", strokeWidth: 1 }}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={(v: number) => fmtCompact(v)}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            width={40}
          />
          <Tooltip
            content={<PbiTooltip grain={grain} />}
            cursor={{ fill: "rgba(0,0,0,0.05)" }}
            isAnimationActive={false}
          />
          {showBot && (
            <Bar
              dataKey="bot"
              name="Bots"
              stackId="e"
              fill="var(--series-bot)"
              stroke="#fff"
              strokeWidth={2}
              maxBarSize={24}
              radius={audience === "bot" ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          )}
          {showHuman && (
            <Bar
              dataKey="human"
              name="Human"
              stackId="e"
              fill="var(--series-human)"
              stroke="#fff"
              strokeWidth={2}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
            />
          )}
        </BarChart>
      </ResponsiveContainer>

      {/* legend (always present for 2 series) + hint */}
      <div className="mt-1 flex flex-wrap items-center gap-4 text-xs" style={{ color: "var(--ink-2)" }}>
        {showHuman && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" style={{ width: 10, height: 10, background: "var(--series-human)", borderRadius: 2 }} />
            Human edits
          </span>
        )}
        {showBot && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" style={{ width: 10, height: 10, background: "var(--series-bot)", borderRadius: 2 }} />
            Bot edits
          </span>
        )}
        <span className="ml-auto" style={{ color: "var(--muted)" }}>
          {onBucketClick
            ? selectedLabel
              ? `Filtered: ${selectedLabel} — click another column or clear`
              : "Click a column to cross-filter the dashboard"
            : "Values also listed in the table below"}
        </span>
      </div>
    </div>
  );
}

export { editsFor };
