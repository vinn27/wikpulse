"""
WikiPulse aggregator.

Consumes new edits from the Redpanda topic (only messages since the consumer
group's last committed offset - Kafka does the checkpointing), aggregates them
with PySpark into 1-minute windows, and upserts the results into Neon Postgres.
Also (re)creates the target tables if they don't exist, so a fresh CI runner
needs no manual setup.

Env vars (see .env.example):
    REDPANDA_BROKER, REDPANDA_USER, REDPANDA_PASSWORD, TOPIC, DATABASE_URL
"""
import json
import os
import sys
import time
from datetime import timezone
from pathlib import Path

# make PySpark use this exact interpreter (Windows lacks a 'python3' alias;
# on CI runners this is a harmless no-op)
os.environ.setdefault("PYSPARK_PYTHON", sys.executable)
os.environ.setdefault("PYSPARK_DRIVER_PYTHON", sys.executable)

import psycopg2
from confluent_kafka import Consumer
from dotenv import load_dotenv
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

load_dotenv()

TOPIC = os.getenv("TOPIC", "wikipedia-edits")
GROUP = "wikpulse-aggregator"
SCHEMA_FILE = Path(__file__).parent.parent / "sql" / "schema.sql"

EVENT_SCHEMA = (
    "rcid LONG, title STRING, user STRING, timestamp STRING, "
    "type STRING, bot BOOLEAN, delta LONG, comment STRING"
)

UPSERT_WINDOW = """
INSERT INTO edit_windows
    (window_start, edits, bot_edits, human_edits, unique_editors,
     new_pages, bytes_added, bytes_removed, updated_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
ON CONFLICT (window_start) DO UPDATE SET
    edits = EXCLUDED.edits,
    bot_edits = EXCLUDED.bot_edits,
    human_edits = EXCLUDED.human_edits,
    unique_editors = EXCLUDED.unique_editors,
    new_pages = EXCLUDED.new_pages,
    bytes_added = EXCLUDED.bytes_added,
    bytes_removed = EXCLUDED.bytes_removed,
    updated_at = now();
"""

UPSERT_TOP_PAGE = """
INSERT INTO top_pages (window_start, page_title, edits, net_bytes)
VALUES (%s, %s, %s, %s)
ON CONFLICT (window_start, page_title) DO UPDATE SET
    edits = EXCLUDED.edits,
    net_bytes = EXCLUDED.net_bytes;
"""


def make_consumer():
    return Consumer({
        "bootstrap.servers": os.environ["REDPANDA_BROKER"],
        "security.protocol": "SASL_SSL",
        "sasl.mechanisms": "SCRAM-SHA-256",
        "sasl.username": os.environ["REDPANDA_USER"],
        "sasl.password": os.environ["REDPANDA_PASSWORD"],
        "group.id": GROUP,
        "auto.offset.reset": "earliest",  # first-ever run reads from the start
        # OFFSETS ARE COMMITTED MANUALLY, ONLY AFTER A SUCCESSFUL NEON LOAD.
        # With auto-commit, a failed DB write used to skip the batch forever
        # (36 quota-failed runs each dropped their ~680 events). Offsetting
        # after the load gives at-least-once; the rcid dedup + upserts make
        # redelivery harmless.
        "enable.auto.commit": False,
    })


def poll_batch(consumer, max_seconds: int = 60):
    """Poll the topic until it goes quiet.

    Returns (events, offsets) where offsets are the next-to-consume positions
    per partition - the caller commits them only after the data is safely in
    Postgres.
    """
    consumer.subscribe([TOPIC])

    events = []
    offsets = {}
    idle_rounds = 0
    # partition assignment (group join over SASL/SSL) can take 10s+ on a
    # fresh consumer - stay patient through the quiet start, only bail once
    # the topic has actually gone quiet
    max_idle_rounds = 20
    deadline = time.time() + max_seconds
    while time.time() < deadline and idle_rounds < max_idle_rounds:
        msg = consumer.poll(1.0)
        if msg is None or msg.error():
            idle_rounds += 1
            continue
        idle_rounds = 0
        events.append(json.loads(msg.value()))
        offsets[msg.partition()] = msg.offset() + 1

    return events, offsets


def aggregate(events):
    """1-minute edit windows + hottest human-edited pages, via PySpark."""
    spark = (
        SparkSession.builder
        .appName("wikpulse-aggregator")
        .master("local[*]")
        .getOrCreate()
    )
    try:
        df = spark.createDataFrame(events, EVENT_SCHEMA)
        # producer windows can overlap on reruns -> drop duplicate edits
        df = df.dropDuplicates(["rcid"])
        df = df.withColumn(
            "ts", F.to_timestamp("timestamp", "yyyy-MM-dd'T'HH:mm:ss'Z'")
        )
        minute = F.date_trunc("minute", "ts").alias("window_start")

        windows = (
            df.groupBy(minute)
            .agg(
                F.count("*").alias("edits"),
                F.sum(F.when(F.col("bot"), 1).otherwise(0)).alias("bot_edits"),
                F.countDistinct("user").alias("unique_editors"),
                F.sum(F.when(F.col("type") == "new", 1).otherwise(0)).alias("new_pages"),
                F.sum(F.when(F.col("delta") > 0, F.col("delta")).otherwise(0)).alias("bytes_added"),
                F.sum(F.when(F.col("delta") < 0, -F.col("delta")).otherwise(0)).alias("bytes_removed"),
            )
            .withColumn("human_edits", F.col("edits") - F.col("bot_edits"))
        )

        top_pages = (
            df.filter(~F.col("bot"))  # hottest pages humans actually edited
            .groupBy(minute, "title")
            .agg(F.count("*").alias("edits"), F.sum("delta").alias("net_bytes"))
            .filter(F.col("edits") >= 2)
            .orderBy(F.col("edits").desc())
        )

        return windows.collect(), top_pages.collect()
    finally:
        spark.stop()


def to_utc(dt):
    """MediaWiki timestamps are UTC; make that explicit for Postgres TIMESTAMPTZ."""
    return dt.replace(tzinfo=timezone.utc)


PRUNE_SQL = """
DELETE FROM top_pages  WHERE window_start < now() - interval '7 days';
DELETE FROM edit_windows WHERE window_start < now() - interval '7 days';
"""
# the dashboard only ever reads the last 48h/7d, so rows older than that are
# dead weight. Without this the tables grew forever and pushed the Neon free
# project over its storage quota ("Your account or project has exceeded the
# quota"), which took the whole pipeline down.


def load_to_neon(windows, top_pages):
    # Neon cold starts (scale-to-zero) occasionally refuse the first dial -
    # retry a couple of times before giving up so a wake-up blip doesn't fail
    # the run (a quota error still fails, as it should).
    conn = None
    for attempt in range(3):
        try:
            conn = psycopg2.connect(os.environ["DATABASE_URL"])
            break
        except psycopg2.OperationalError:
            if attempt == 2:
                raise
            time.sleep(5)
    try:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_FILE.read_text())
            cur.executemany(
                UPSERT_WINDOW,
                [(to_utc(r["window_start"]), r["edits"], r["bot_edits"],
                  r["human_edits"], r["unique_editors"], r["new_pages"],
                  r["bytes_added"], r["bytes_removed"]) for r in windows],
            )
            cur.executemany(
                UPSERT_TOP_PAGE,
                [(to_utc(r["window_start"]), r["title"], r["edits"], r["net_bytes"])
                 for r in top_pages],
            )
            cur.execute(PRUNE_SQL)
        conn.commit()
    finally:
        conn.close()


def main():
    consumer = make_consumer()
    try:
        events, offsets = poll_batch(consumer)
        if not events:
            print("consumed=0 nothing to do")
            return
        print(f"consumed={len(events)}")

        windows, top_pages = aggregate(events)
        load_to_neon(windows, top_pages)
        print(f"windows_upserted={len(windows)} top_pages_upserted={len(top_pages)}")

        # only now that Postgres has the data: commit the consumer group's
        # offsets so a failed load replays this batch on the next run
        from confluent_kafka import TopicPartition
        consumer.commit(
            offsets=[TopicPartition(TOPIC, p, o) for p, o in offsets.items()],
            asynchronous=False,
        )
    finally:
        consumer.close()


if __name__ == "__main__":
    main()
