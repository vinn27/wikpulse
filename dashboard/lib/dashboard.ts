// Shared types + helpers for the WikiPulse dashboard.

export type Row = {
  t: string; // bucket start, ISO
  edits: number;
  bot: number;
  human: number;
  editors: number;
  newPages: number;
};

export type PageRow = {
  hour: string; // hour bucket start, ISO
  title: string;
  edits: number;
  netBytes: number;
};

export type Payload = {
  minutes: Row[]; // 1-minute windows, last 48h
  hours: Row[]; // 1-hour rollups, last 7d
  pages: PageRow[]; // per page per hour, last 7d
  fetchedAt: string;
};

export const RANGES = [
  { id: "1h", label: "Last 1h", mins: 60 },
  { id: "3h", label: "Last 3h", mins: 180 },
  { id: "12h", label: "Last 12h", mins: 720 },
  { id: "24h", label: "Last 24h", mins: 1440 },
  { id: "7d", label: "Last 7d", mins: 10080 },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];
export type Audience = "all" | "human" | "bot";
export type Grain = "minute" | "hour" | "day";

export type Selection = {
  start: number; // epoch ms
  end: number;
  grain: Grain;
  label: string;
} | null;

export function fmtInt(n: number): string {
  return n.toLocaleString("en-IN");
}

export function fmtCompact(n: number): string {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function fmtBytes(n: number): string {
  const sign = n < 0 ? "−" : "+";
  const a = Math.abs(n);
  if (a < 1024) return `${sign}${a} B`;
  if (a < 1024 * 1024) return `${sign}${(a / 1024).toFixed(1)} KB`;
  return `${sign}${(a / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// value of `edits` for the current audience filter
export function editsFor(r: Row, audience: Audience): number {
  if (audience === "human") return r.human;
  if (audience === "bot") return r.bot;
  return r.edits;
}

export function bucketLabel(iso: string, grain: Grain): string {
  const d = new Date(iso);
  if (grain === "day") return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (grain === "hour") {
    // include the date — hour-only labels are meaningless across days
    const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return `${day} ${time}`;
  }
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function fullLabel(iso: string, grain: Grain): string {
  const d = new Date(iso);
  if (grain === "day") return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  if (grain === "hour") return d.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

// "30 Sep, 14:05" — unambiguous local timestamp for range subtitles
export function stampLabel(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time}`;
}

export const GRAIN_MS: Record<Grain, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

// aggregate hourly page rows up to one row per page
export function aggregatePages(rows: PageRow[]): Array<{ title: string; edits: number; netBytes: number }> {
  const m = new Map<string, { title: string; edits: number; netBytes: number }>();
  for (const r of rows) {
    const cur = m.get(r.title) ?? { title: r.title, edits: 0, netBytes: 0 };
    cur.edits += r.edits;
    cur.netBytes += r.netBytes;
    m.set(r.title, cur);
  }
  return [...m.values()];
}

// client-side CSV download (Excel-friendly)
export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
