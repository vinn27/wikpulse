-- WikiPulse serving tables in Neon Postgres.
-- Idempotent: aggregator re-runs this before every load.

CREATE TABLE IF NOT EXISTS edit_windows (
    window_start   TIMESTAMPTZ PRIMARY KEY,   -- 1-minute bucket
    edits          INTEGER     NOT NULL,
    bot_edits      INTEGER     NOT NULL,
    human_edits    INTEGER     NOT NULL,
    unique_editors INTEGER     NOT NULL,
    new_pages      INTEGER     NOT NULL,
    bytes_added    BIGINT      NOT NULL,
    bytes_removed  BIGINT      NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS top_pages (
    window_start TIMESTAMPTZ NOT NULL,
    page_title   TEXT        NOT NULL,
    edits        INTEGER     NOT NULL,
    net_bytes    BIGINT      NOT NULL,
    PRIMARY KEY (window_start, page_title)
);

CREATE INDEX IF NOT EXISTS idx_top_pages_window ON top_pages (window_start DESC);
