"use client";

// Hottest-pages table: zebra rows, tabular numerals in columns,
// sortable headers, search box, Wikipedia deep links.
import { useMemo, useState } from "react";
import { aggregatePages, fmtBytes, fmtInt, type PageRow } from "@/lib/dashboard";

type SortKey = "edits" | "netBytes";

export default function PagesTable({
  rows,
  search,
  onSearch,
  compact = false,
}: {
  rows: PageRow[];
  search: string;
  onSearch: (v: string) => void;
  compact?: boolean;
}) {
  const [sort, setSort] = useState<SortKey>("edits");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const aggregated = useMemo(() => aggregatePages(rows), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = q ? aggregated.filter((p) => p.title.toLowerCase().includes(q)) : aggregated;
    out.sort((a, b) => (dir === "desc" ? b[sort] - a[sort] : a[sort] - b[sort]));
    return out;
  }, [aggregated, search, sort, dir]);

  const max = filtered[0] ? (sort === "edits" ? filtered[0].edits : Math.abs(filtered[0].netBytes) || 1) : 1;

  const th = (key: SortKey, label: string, alignRight = true) => (
    <th
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium ${alignRight ? "text-right" : "text-left"}`}
      style={{ color: "var(--ink-2)" }}
      onClick={() => {
        if (sort === key) setDir(dir === "desc" ? "asc" : "desc");
        else {
          setSort(key);
          setDir("desc");
        }
      }}
      aria-sort={sort === key ? (dir === "desc" ? "descending" : "ascending") : "none"}
    >
      {label} {sort === key ? (dir === "desc" ? "▼" : "▲") : ""}
    </th>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search pages…"
          className="w-56 rounded border px-2.5 py-1.5 text-xs outline-none focus:border-[var(--series-human)]"
          style={{ borderColor: "var(--grid)", background: "var(--tile)", color: "var(--ink)" }}
        />
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {filtered.length} pages
        </span>
      </div>
      <div className={`thin-scroll overflow-auto ${compact ? "max-h-[46vh]" : ""}`}>
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0" style={{ background: "var(--tile)" }}>
            <tr style={{ borderBottom: "1px solid var(--grid)" }}>
              <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--ink-2)" }}>
                #
              </th>
              <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--ink-2)" }}>
                Page
              </th>
              {th("edits", "Edits")}
              {th("netBytes", "Net bytes")}
              <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--ink-2)" }}>
                Share of top
              </th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {filtered.slice(0, compact ? 8 : 200).map((p, i) => (
              <tr key={p.title} style={{ background: i % 2 ? "#faf9f8" : undefined }}>
                <td className="px-3 py-1.5" style={{ color: "var(--muted)" }}>
                  {i + 1}
                </td>
                <td className="max-w-[380px] truncate px-3 py-1.5">
                  <a
                    href={`https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {p.title}
                  </a>
                </td>
                <td className="px-3 py-1.5 text-right font-medium">{fmtInt(p.edits)}</td>
                <td className="px-3 py-1.5 text-right" style={{ color: p.netBytes < 0 ? "#d03b3b" : "var(--good)" }}>
                  {fmtBytes(p.netBytes)}
                </td>
                <td className="px-3 py-1.5">
                  <span
                    aria-hidden="true"
                    className="block h-[6px] rounded-sm"
                    style={{
                      width: `${Math.max(2, ((sort === "edits" ? p.edits : Math.abs(p.netBytes)) / max) * 100)}%`,
                      background: "var(--series-human)",
                      opacity: 0.75,
                    }}
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center" style={{ color: "var(--muted)" }}>
                  {rows.length === 0
                    ? "No page data in this time window — the pipeline may be behind; try a wider range."
                    : "No pages match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
