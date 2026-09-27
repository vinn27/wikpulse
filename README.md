# WikiPulse 📡

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
Dashboard (Next.js on Vercel) — live URL
```

Scheduled by GitHub Actions (public repo = free minutes). Secrets live in
Actions, never in code.

**Status:** Phase 1 — pipeline working locally. CI schedule + dashboard next.

See `.env.example` for required configuration.
