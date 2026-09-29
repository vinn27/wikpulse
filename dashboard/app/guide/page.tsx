import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WikiPulse — Dashboard Guide",
  description: "How to read and use the WikiPulse live Wikipedia analytics dashboard.",
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-2 mt-8 text-lg font-semibold">{children}</h2>
);

export default function GuidePage() {
  return (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-5 py-8 text-[14px]" style={{ color: "var(--ink-2)" }}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          WikiPulse — Dashboard Guide 📡
        </h1>
        <p className="mt-1">
          Everything you need to read this dashboard in 60 seconds — no data-engineering background required.
        </p>
        <div className="mt-3 flex gap-2">
          <a
            href="/"
            className="seg"
            style={{ background: "var(--ink)", color: "#fff", boxShadow: "inset 0 -3px 0 var(--accent)", textDecoration: "none", display: "inline-block" }}
          >
            ← Open the dashboard
          </a>
          <a
            href="https://github.com/vinn27/wikpulse"
            target="_blank"
            rel="noopener noreferrer"
            className="seg"
            style={{ border: "1px solid var(--grid)", textDecoration: "none", display: "inline-block" }}
          >
            Source code ↗
          </a>
        </div>
      </header>

      <H2>What is this?</H2>
      <p>
        Wikipedia is edited thousands of times every hour by people and automated bots around the world.
        WikiPulse <strong>records that activity automatically</strong> and shows it live: how busy Wikipedia is
        right now, how much of the work is human, and which articles are getting the most attention — often
        the first visible trace of breaking news.
      </p>

      <H2>Reading the screen in 30 seconds</H2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong style={{ color: "var(--ink)" }}>📌 Insight sentence</strong> (yellow bar, top) — the dashboard
          writes the story for you: volume, human share, busiest moment, hottest page. It follows your filters.
        </li>
        <li>
          <strong style={{ color: "var(--ink)" }}>Four stat tiles</strong> — Total edits, Human share, Active
          editors, New articles. Hover the <em>ⓘ</em> on each tile for its plain-English definition.
        </li>
        <li>
          <strong style={{ color: "var(--ink)" }}>The chart</strong> — one column per minute/hour/day.{" "}
          <span style={{ color: "var(--series-human)", fontWeight: 600 }}>Blue = people</span>,{" "}
          <span style={{ color: "var(--series-bot)", fontWeight: 600 }}>orange = bots</span>. Hover any column
          for exact numbers; click it to filter everything.
        </li>
        <li>
          <strong style={{ color: "var(--ink)" }}>Hottest pages</strong> — most-edited articles in your window.
          Click a page name to open the actual Wikipedia article.
        </li>
      </ul>

      <H2>Every interaction (yes, like Power BI)</H2>
      <div className="tile space-y-3 p-4">
        <p>
          <strong style={{ color: "var(--ink)" }}>Time range</strong> — Last 1h → 7d, plus <em>All data</em>{" "}
          (everything ever collected). Every visual re-renders against the same slice.
        </p>
        <p>
          <strong style={{ color: "var(--ink)" }}>Human / Bots / All</strong> — show only people's edits, only
          bots', or both. Affects tiles, chart and totals.
        </p>
        <p>
          <strong style={{ color: "var(--ink)" }}>Click-to-cross-filter</strong> — click any chart column and the
          entire dashboard filters to that moment; a ✕ chip appears to clear it (or press <kbd>Esc</kbd>).
        </p>
        <p>
          <strong style={{ color: "var(--ink)" }}>Drilldown</strong> — Minute → Hour → Day buttons change the
          chart's grain; <em>All data</em> + Day shows the full history.
        </p>
        <p>
          <strong style={{ color: "var(--ink)" }}>Focus mode (⤢)</strong> — expand any visual fullscreen, with
          its complete data table underneath (nothing is hidden behind tooltips). Close with ✕ or <kbd>Esc</kbd>.
        </p>
        <p>
          <strong style={{ color: "var(--ink)" }}>Search & sort</strong> — find any page in the table; click{" "}
          <em>Edits</em> or <em>Net bytes</em> headers to sort.
        </p>
        <p>
          <strong style={{ color: "var(--ink)" }}>⬇ CSV</strong> — download exactly what you see (chart buckets
          or the pages table) as a clean CSV for Excel/Power BI/Tableau.
        </p>
        <p>
          <strong style={{ color: "var(--ink)" }}>Shareable links</strong> — the URL always carries your current
          filters (e.g. <code>?range=24h&amp;aud=human</code>). Copy the address bar to send someone a
          pre-filtered view.
        </p>
      </div>

      <H2>Glossary</H2>
      <dl className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
        <div>
          <dt className="font-medium" style={{ color: "var(--ink)" }}>Window / bucket</dt>
          <dd>A slice of time (1 minute by default). Every number on the page is per-bucket, then summed for your selected range.</dd>
        </div>
        <div>
          <dt className="font-medium" style={{ color: "var(--ink)" }}>Bot</dt>
          <dd>An automated Wikipedia account — they fix typos, format tables and patrol vandalism at machine speed. Typically 20–50% of all edits.</dd>
        </div>
        <div>
          <dt className="font-medium" style={{ color: "var(--ink)" }}>Net bytes</dt>
          <dd>Bytes added minus bytes removed on a page. Green = article grew; red = content was cut (often vandalism cleanup).</dd>
        </div>
        <div>
          <dt className="font-medium" style={{ color: "var(--ink)" }}>Active editors</dt>
          <dd>Distinct editors per bucket, summed. Same person active in 10 minutes counts 10× — read it as engagement volume, not unique people.</dd>
        </div>
        <div>
          <dt className="font-medium" style={{ color: "var(--ink)" }}>Hottest pages</dt>
          <dd>Articles with 2+ <em>human</em> edits in a bucket. Spikes usually mean news, sports finals, or something trending.</dd>
        </div>
        <div>
          <dt className="font-medium" style={{ color: "var(--ink)" }}>Data as of</dt>
          <dd>When the pipeline last wrote. Refreshes every 30 seconds; the pipeline ingests every 10 minutes.</dd>
        </div>
      </dl>

      <H2>“Last 1h is empty — is it broken?”</H2>
      <p>
        No — and this is the most common confusion. <strong>Last 1h means the most recent hour counting back
        from right now</strong>, not “any hour of data”. If the amber banner says data is a few hours old
        (pipeline delay or a paused job), then recent windows simply don't exist yet. Older data is all still
        there — switch to <em>Last 12h</em> or <em>All data</em> and you'll see it, gaps included. The amber
        banner is the dashboard being honest about freshness instead of quietly showing blanks.
      </p>

      <H2>Under the hood (for the technically curious)</H2>
      <pre
        className="thin-scroll tile mt-2 overflow-x-auto p-4 text-xs"
        style={{ color: "var(--ink)" }}
      >{`Wikipedia RecentChanges API (public, no key)
      │  every 10 min, a scheduled GitHub Actions job…
      ▼
Redpanda (Kafka-compatible event stream)
      │  …producer streams each edit as a message…
      ▼
PySpark aggregation  →  1-minute windows + hottest pages
      │  …aggregator upserts idempotently…
      ▼
Neon Postgres (edit_windows, top_pages)
      │  …this page reads via a SELECT-ONLY key…
      ▼
Next.js dashboard on Netlify — refreshes every 30 s`}</pre>
      <p className="mt-2">
        Failures are loud by design: if any step breaks, the run turns red on{" "}
        <a href="https://github.com/vinn27/wikpulse/actions" target="_blank" rel="noopener noreferrer" className="underline">
          GitHub Actions
        </a>{" "}
        and the dashboard shows the amber freshness banner — never a silent blank.
      </p>

      <footer className="mt-10 pb-4 text-center text-[11px]" style={{ color: "var(--muted)" }}>
        WikiPulse · built by Vinit Sontakke · 100% free-tier services ·{" "}
        <a href="/" className="underline">back to dashboard</a>
      </footer>
    </main>
  );
}
