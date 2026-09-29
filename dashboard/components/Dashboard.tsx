"use client";

// WikiPulse dashboard shell: one filter row above everything it scopes,
// KPI tiles, drillable trend chart with cross-filtering, hottest-pages
// table, Power BI-style focus mode, 30s auto-refresh (previous render is
// held at reduced opacity — no skeleton flash).
import { useCallback, useEffect, useMemo, useState } from "react";
import KpiTiles, { type Tile } from "@/components/KpiTiles";
import TrendChart from "@/components/TrendChart";
import PagesTable from "@/components/PagesTable";
import FocusOverlay from "@/components/FocusOverlay";
import {
  RANGES,
  editsFor,
  fmtInt,
  fmtPct,
  fullLabel,
  GRAIN_MS,
  type Audience,
  type Grain,
  type PageRow,
  type Payload,
  type RangeId,
  type Row,
  type Selection,
} from "@/lib/dashboard";

const AUDIENCES: Array<{ id: Audience; label: string }> = [
  { id: "all", label: "All edits" },
  { id: "human", label: "Human" },
  { id: "bot", label: "Bots" },
];

const RANGES_WITH_ALL = [
  ...RANGES,
  { id: "all" as const, label: "All data", mins: 10080 },
];

type RangeIdAll = RangeId | "all";

export default function Dashboard() {
  const [data, setData] = useState<Payload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeId, setRangeId] = useState<RangeIdAll>("3h");
  const [audience, setAudience] = useState<Audience>("all");
  const [drill, setDrill] = useState<Grain | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState<"chart" | "table" | null>(null);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const range = RANGES_WITH_ALL.find((r) => r.id === rangeId) ?? RANGES[1];

  // reset a drill level that has no data at the current range
  useEffect(() => {
    if (drill === "minute" && range.mins > 720) setDrill(null);
    if (drill === "day" && range.mins < 720) setDrill(null);
  }, [rangeId, drill, range.mins]);

  const view = useMemo(() => {
    if (!data) return null;
    const nowMs = Date.parse(data.fetchedAt);
    const rangeStart = nowMs - range.mins * 60_000;

    // cross-filter selection ∩ time range
    let scopeStart = rangeStart;
    let scopeEnd = nowMs;
    let effSel: Selection = null;
    if (sel && sel.start < nowMs && sel.end > rangeStart) {
      scopeStart = Math.max(scopeStart, sel.start);
      scopeEnd = Math.min(scopeEnd, sel.end);
      effSel = sel;
    }

    const grain: Grain = drill ?? (range.mins <= 720 ? "minute" : "hour");
    const inScope = (r: Row) => {
      const t = Date.parse(r.t);
      return t >= scopeStart && t < scopeEnd;
    };

    let rows: Row[];
    if (grain === "minute") rows = data.minutes.filter(inScope);
    else if (grain === "hour") rows = data.hours.filter(inScope);
    else {
      // day grain: roll hours up to local calendar days
      const m = new Map<number, Row>();
      for (const r of data.hours) {
        const t = Date.parse(r.t);
        if (t < scopeStart || t >= scopeEnd) continue;
        const day = new Date(t).setHours(0, 0, 0, 0);
        const cur =
          m.get(day) ??
          ({ t: new Date(day).toISOString(), edits: 0, bot: 0, human: 0, editors: 0, newPages: 0 } as Row);
        cur.edits += r.edits;
        cur.bot += r.bot;
        cur.human += r.human;
        cur.editors += r.editors;
        cur.newPages += r.newPages;
        m.set(day, cur);
      }
      rows = [...m.values()].sort((a, b) => a.t.localeCompare(b.t));
    }

    // previous equal-length window, same grain, for the delta on tile 1
    const len = scopeEnd - scopeStart;
    const baseRows = grain === "minute" ? data.minutes : grain === "hour" ? data.hours : rows;
    const prev = baseRows.filter((r) => {
      const t = Date.parse(r.t);
      return t >= scopeStart - len && t < scopeStart;
    });

    const sum = (rs: Row[], f: (r: Row) => number) => rs.reduce((a, r) => a + f(r), 0);
    const total = sum(rows, (r) => editsFor(r, audience));
    const prevTotal = sum(prev, (r) => editsFor(r, audience));
    const humanTotal = sum(rows, (r) => r.human);
    const editsTotal = sum(rows, (r) => r.edits);

    const spark = rows.slice(-12).map((r) => editsFor(r, audience));

    // pages scoped to the same window (page data is hourly)
    const hourFloor = (ms: number) => new Date(ms).setMinutes(0, 0, 0);
    const pages: PageRow[] = data.pages.filter((p) => {
      const t = Date.parse(p.hour);
      return t >= hourFloor(scopeStart) && t <= scopeEnd;
    });

    const tiles: Tile[] = [
      {
        label: "Total edits",
        value: fmtInt(total),
        delta: total - prevTotal,
        deltaPct: prevTotal ? ((total - prevTotal) / prevTotal) * 100 : undefined,
        sub: `in selected range · vs previous ${range.label.replace("Last ", "").toLowerCase()}`,
        upIsGood: true,
        spark,
        hint: `Every edit to English Wikipedia articles in the selected window (${audience === "all" ? "people + bots" : audience === "human" ? "people only" : "bots only"}).`,
      },
      {
        label: "Human share of edits",
        value: editsTotal ? fmtPct((humanTotal / editsTotal) * 100) : "—",
        sub: "the rest is automated bots",
        spark: rows.slice(-12).map((r) => (r.edits ? (r.human / r.edits) * 100 : 0)),
        hint: "Bots do a large share of Wikipedia's cleanup work — a healthy mix is typically 50–80% human.",
      },
      {
        label: "Active editors",
        value: fmtInt(sum(rows, (r) => r.editors)),
        sub: "distinct editors per bucket, summed",
        hint: "Each bucket counts its own distinct editors, then buckets are added — so the same editor active in many minutes counts multiple times. Read it as engagement volume, not unique people.",
      },
      {
        label: "New articles created",
        value: fmtInt(sum(rows, (r) => r.newPages)),
        sub: "first-time pages, not edits",
        hint: "Brand-new Wikipedia articles published in the window.",
      },
    ];

    return { rows, grain, tiles, pages, effSel, nowMs, total, editsTotal, humanTotal };
  }, [data, range, audience, sel, drill]);

  const onBucketClick = useCallback(
    (row: Row) => {
      const grain: Grain = view?.grain ?? "hour";
      const start = Date.parse(row.t);
      const next: Selection = {
        start,
        end: start + GRAIN_MS[grain === "minute" ? "minute" : grain === "hour" ? "hour" : "day"],
        grain,
        label: fullLabel(row.t, grain),
      };
      setSel((cur) => (cur && cur.label === next.label ? null : next));
    },
    [view],
  );

  if (!data || !view) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {error ? `Could not load data: ${error}` : "Loading WikiPulse…"}
        </p>
      </main>
    );
  }

  const dataAsOf = new Date(view.nowMs).toLocaleTimeString("en-GB");
  // data-freshness guard: warn loudly instead of silently blanking
  const newestMinute = data.minutes.length ? Date.parse(data.minutes[data.minutes.length - 1].t) : 0;
  const staleMin = Math.round((view.nowMs - newestMinute) / 60_000);
  const isStale = newestMinute === 0 || staleMin > 15;
  const lastWriteLabel = newestMinute
    ? new Date(newestMinute).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "never";

  // auto-written summary — a BA should get the story from this one line
  const coveredMin = view.rows.length > 1
    ? Math.max(1, Math.round((Date.parse(view.rows[view.rows.length - 1].t) - Date.parse(view.rows[0].t)) / 60_000))
    : 0;
  const editsPerMin = coveredMin ? Math.round(view.total / coveredMin) : 0;
  const humanPct = view.editsTotal ? Math.round((view.humanTotal / view.editsTotal) * 100) : 0;
  const busiest = view.rows.reduce<Row | null>(
    (m, r) => (!m || editsFor(r, audience) > editsFor(m, audience) ? r : m),
    null,
  );
  const topPage = view.pages.reduce<{ title: string; edits: number } | null>(
    (m, p) => (!m || p.edits > m.edits ? { title: p.title, edits: p.edits } : m),
    null,
  );

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-5">
      {/* header */}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            WikiPulse
            <span
              className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
              style={{ background: "var(--accent)", color: "var(--ink)" }}
            >
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-black" />
              LIVE
            </span>
          </h1>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Wikipedia edits, tracked end-to-end — GitHub Actions → Redpanda (Kafka) → PySpark → Neon → this page
          </p>
        </div>
        <div className="text-right text-xs" style={{ color: "var(--muted)" }}>
          <div>
            Data as of {dataAsOf} · auto-refresh 30s {refreshing && "· refreshing…"}
          </div>
          <a
            className="hover:underline"
            href="https://github.com/vinn27/wikpulse"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/vinn27/wikpulse ↗
          </a>
        </div>
      </header>

      {isStale && (
        <div
          className="mb-3 rounded border px-3 py-2 text-xs"
          style={{ borderColor: "#fab219", background: "#fdf6e3", color: "var(--ink)" }}
          role="status"
        >
          ⚠ <strong>Data is {staleMin} min old</strong> — newest window{" "}
          {newestMinute ? new Date(newestMinute).toLocaleTimeString("en-GB") : "never"}. The pipeline
          (GitHub Actions, every 10 min) may be behind or paused; ranges shorter than that gap will
          look empty.
        </div>
      )}

      {error && (
        <div className="mb-3 rounded border px-3 py-2 text-xs" style={{ borderColor: "#d03b3b", color: "#d03b3b" }}>
          Last refresh failed ({error}) — showing previous data.
        </div>
      )}

      {/* one filter row, above everything it scopes */}
      <div
        className="tile mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2"
        style={{ opacity: refreshing ? 0.7 : 1 }}
      >
        <div className="flex items-center gap-1" role="group" aria-label="Time range">
          {RANGES_WITH_ALL.map((r) => (
            <button key={r.id} className="seg" data-active={r.id === rangeId} onClick={() => setRangeId(r.id as RangeIdAll)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Audience">
          {AUDIENCES.map((a) => (
            <button key={a.id} className="seg" data-active={a.id === audience} onClick={() => setAudience(a.id)}>
              {a.label}
            </button>
          ))}
        </div>
        {view.effSel && (
          <button
            className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
            style={{ borderColor: "var(--series-human)", color: "var(--ink)" }}
            onClick={() => setSel(null)}
          >
            ✕ Filtered: {view.effSel.label}
          </button>
        )}
      </div>

      {/* everything below re-renders against the same slice; hold previous render while refreshing */}
      <div className="transition-opacity duration-200" style={{ opacity: refreshing ? 0.6 : 1 }}>
        {/* smart-narrative summary */}
        <div className="tile mb-3 px-4 py-3 text-[13px]" style={{ borderLeft: "4px solid var(--accent)" }}>
          {view.rows.length === 0 ? (
            <span style={{ color: "var(--ink-2)" }}>
              📌 <strong>No data in this window</strong> — the pipeline last wrote at {lastWriteLabel}. Widen the
              time range (try <em>All data</em>) to see what has been collected so far.
            </span>
          ) : (
            <span>
              📌 <strong>{fmtInt(view.total)} edits</strong> across {fmtInt(coveredMin)} minutes of data —{" "}
              about <strong>{editsPerMin} edits/min</strong>, <strong>{humanPct}% by humans</strong>.
              {busiest && (
                <>
                  {" "}Busiest {view.grain}: <strong>{fullLabel(busiest.t, view.grain)}</strong> ({fmtInt(editsFor(busiest, audience))} edits).
                </>
              )}
              {topPage && (
                <>
                  {" "}Most-edited page: <strong>{topPage.title}</strong> ({fmtInt(topPage.edits)} edits).
                </>
              )}
            </span>
          )}
        </div>

        <KpiTiles tiles={view.tiles} />

        <section className="tile mt-3 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Edit volume over time
              <span className="ml-2 font-normal text-xs" style={{ color: "var(--muted)" }}>
                each column = one {view.grain} · blue = people, orange = bots · click a column to filter
              </span>
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1" role="group" aria-label="Drill level">
                {(["minute", "hour", "day"] as Grain[]).map((g) => {
                  const disabled = (g === "minute" && range.mins > 720) || (g === "day" && range.mins < 720);
                  return (
                    <button
                      key={g}
                      className="seg"
                      data-active={view.grain === g}
                      disabled={disabled}
                      style={disabled ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
                      onClick={() => setDrill(view.grain === g ? null : g)}
                      title={disabled ? "Not enough range for this level" : `Drill to ${g}s`}
                    >
                      {g === "minute" ? "Minute" : g === "hour" ? "Hour" : "Day"}
                    </button>
                  );
                })}
              </div>
              <button
                className="rounded px-1.5 py-1 text-sm hover:bg-black/5"
                aria-label="Expand chart (focus mode)"
                title="Focus mode"
                onClick={() => setFocus("chart")}
              >
                ⤢
              </button>
            </div>
          </div>
          {view.rows.length === 0 ? (
            <div
              className="flex h-[280px] flex-col items-center justify-center rounded text-center"
              style={{ border: "1px dashed var(--grid)", color: "var(--muted)" }}
            >
              <div className="text-sm font-medium">No edits recorded in this window</div>
              <div className="mt-1 text-xs">
                Pipeline last wrote at {lastWriteLabel} — widen the range (try “All data”)
              </div>
            </div>
          ) : (
            <TrendChart
              rows={view.rows}
              grain={view.grain}
              audience={audience}
              selectedLabel={view.effSel?.label ?? null}
              onBucketClick={onBucketClick}
            />
          )}
        </section>

        <section className="tile mt-3 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Hottest pages
              <span className="ml-2 font-normal text-xs" style={{ color: "var(--muted)" }}>
                ranked by human edits · net bytes = added − removed (green = page grew)
              </span>
            </h2>
            <button
              className="rounded px-1.5 py-1 text-sm hover:bg-black/5"
              aria-label="Expand table (focus mode)"
              title="Focus mode"
              onClick={() => setFocus("table")}
            >
              ⤢
            </button>
          </div>
          <PagesTable rows={view.pages} search={search} onSearch={setSearch} />
        </section>

        {/* plain-language glossary for business readers */}
        <details className="tile mt-3 px-4 py-3 text-xs" style={{ color: "var(--ink-2)" }}>
          <summary className="cursor-pointer text-[13px] font-medium" style={{ color: "var(--ink)" }}>
            How to read this dashboard
          </summary>
          <dl className="mt-3 grid gap-x-8 gap-y-2.5 md:grid-cols-2">
            <div>
              <dt className="font-medium" style={{ color: "var(--ink)" }}>What is being measured?</dt>
              <dd>Every edit made to English Wikipedia articles — public data from Wikipedia's RecentChanges API, collected automatically every 10 minutes.</dd>
            </div>
            <div>
              <dt className="font-medium" style={{ color: "var(--ink)" }}>Human vs bot</dt>
              <dd>Wikipedia flags automated accounts (bots) that do cleanup, formatting and vandalism patrol. The blue/orange split shows people vs automation.</dd>
            </div>
            <div>
              <dt className="font-medium" style={{ color: "var(--ink)" }}>Hottest pages</dt>
              <dd>Articles with 2+ human edits in a period, ranked by edit count. Spikes usually mean breaking news or live events.</dd>
            </div>
            <div>
              <dt className="font-medium" style={{ color: "var(--ink)" }}>Net bytes</dt>
              <dd>Bytes added minus bytes removed. Green = the article grew; red = content was cut (often vandalism removal).</dd>
            </div>
            <div>
              <dt className="font-medium" style={{ color: "var(--ink)" }}>Interactions</dt>
              <dd>Time buttons set the window; Human/Bots filters every visual; click any column to cross-filter the dashboard (✕ chip clears); ⤢ opens focus mode with the full data table; every column is sortable and searchable.</dd>
            </div>
            <div>
              <dt className="font-medium" style={{ color: "var(--ink)" }}>Under the hood</dt>
              <dd>A scheduled GitHub Actions job streams edits through Redpanda (Kafka), aggregates 1-minute windows with PySpark, and upserts into Neon Postgres. This page reads Postgres through a read-only key and refreshes every 30 s. If data is old, an amber banner explains why.</dd>
            </div>
          </dl>
        </details>

        <footer className="mt-4 pb-3 text-center text-[11px]" style={{ color: "var(--muted)" }}>
          Source: en.wikipedia.org RecentChanges · every 10 min a GitHub Actions job streams edits through Redpanda,
          aggregates with PySpark, and upserts into Neon · dashboard on Vercel
        </footer>
      </div>

      {focus === "chart" && (
        <FocusOverlay title={`Edits per ${view.grain} — focus mode`} onClose={() => setFocus(null)}>
          <TrendChart
            rows={view.rows}
            grain={view.grain}
            audience={audience}
            height={Math.min(560, Math.max(320, view.rows.length * 14))}
            selectedLabel={view.effSel?.label ?? null}
            onBucketClick={onBucketClick}
          />
          {/* table-view twin of the chart */}
          <div className="thin-scroll mt-4 max-h-[26vh] overflow-auto">
            <table className="w-full border-collapse text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--grid)", color: "var(--ink-2)" }}>
                  {["Bucket", "Human", "Bots", "Total", "Unique editors"].map((h, i) => (
                    <th key={h} className={`px-3 py-1.5 font-medium ${i ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...view.rows].reverse().map((r) => (
                  <tr key={r.t} className="odd:bg-[#faf9f8]">
                    <td className="px-3 py-1.5">{fullLabel(r.t, view.grain)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtInt(r.human)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtInt(r.bot)}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{fmtInt(r.edits)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtInt(r.editors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FocusOverlay>
      )}

      {focus === "table" && (
        <FocusOverlay title="Hottest pages — focus mode" onClose={() => setFocus(null)}>
          <PagesTable rows={view.pages} search={search} onSearch={setSearch} />
        </FocusOverlay>
      )}
    </main>
  );
}
