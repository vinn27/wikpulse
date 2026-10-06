# WikiPulse 📡

![pipeline](https://github.com/vinn27/wikpulse/actions/workflows/pipeline.yml/badge.svg)

**🖥️ Live dashboard: https://wikpulse-live.netlify.app**

Live analytics on Wikipedia edits — what's being edited, by whom, and how fast, right now.

**Architecture (serverless micro-batch, runs on free tiers):**

```
Wikipedia RecentChanges API (free, no key)
        │
        ▼
src/producer.py ──► Redpanda topic "wikipedia-edits" (Kafka API, SASL/SSL)
        │
        ▼  (consumer group offsets = checkpoint)
src/aggregator.py
   ├─ PySpark aggregation → 1-minute edit windows, top pages
   └─ upsert into Neon Postgres (edit_windows, top_pages)
        │
        ▼
dashboard/ (Next.js on Vercel) — reads Neon via a SELECT-only role;
Power BI-style UX: slicers, minute→hour→day drilldown, click-to-cross-filter,
focus mode, auto-refresh
```

Scheduled by GitHub Actions (public repo = free minutes). Secrets live in
Actions, never in code.

**Status:** Phase 3 — end-to-end: automated pipeline + live dashboard.

## How it runs

A [scheduled GitHub Actions workflow](.github/workflows/pipeline.yml) fires
every 30 minutes on GitHub's free runners (public repo = free minutes): it
pulls the last 35 minutes of en-wiki edits (the extra 5 minutes absorb GitHub's
cron jitter — duplicate edits are dropped by `rcid`), publishes them to
Redpanda, and aggregates with PySpark into Neon. Aggregation still produces
1-minute windows — a run just covers 30 minutes of events at once, and the
slower cadence keeps the Neon free-tier compute quota sustainable. Old
partitions are pruned after 7 days (the dashboard never reads further back).
Both scripts exit non-zero on
failure, so a broken run shows red in the Actions history rather than failing
silently. Kafka offsets are committed only after a successful DB load, so a
failed run replays its batch instead of dropping it.

Honesty notes: GitHub cron runs can lag by several minutes at busy times, so
"every 30 minutes" is approximate; and a monthly
[keepalive workflow](.github/workflows/keepalive.yml) stops GitHub from
auto-disabling the schedule after 60 days of repo inactivity.

See `.env.example` for required configuration (CI reads the same values from
encrypted repo secrets).
