"""
WikiPulse producer.

Pulls recent Wikipedia (en.wikipedia.org) edits from the MediaWiki RecentChanges
API for a lookback window and publishes each edit as a JSON message to the
Redpanda topic. Designed to run as a short-lived job (locally or in GitHub
Actions) - it starts, drains the window, and exits.

Env vars (see .env.example):
    REDPANDA_BROKER, REDPANDA_USER, REDPANDA_PASSWORD, TOPIC
    LOOKBACK_MIN  - size of the window to pull (default 10)
    MAX_PAGES     - API pagination cap, 500 edits per page (default 12)
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import requests
from confluent_kafka import Producer
from dotenv import load_dotenv

load_dotenv()

API_URL = "https://en.wikipedia.org/w/api.php"
TOPIC = os.getenv("TOPIC", "wikipedia-edits")
LOOKBACK_MIN = int(os.getenv("LOOKBACK_MIN", "10"))
MAX_PAGES = int(os.getenv("MAX_PAGES", "12"))  # 12 x 500 = 6,000 edits per run

# Wikimedia asks for a descriptive User-Agent or requests get 403'd
HEADERS = {
    "User-Agent": "WikiPulse/1.0 (https://github.com/vinn27/wikpulse; personal data engineering project)"
}


def fetch_window(start: datetime, end: datetime):
    """Yield recentchange events between start (newer) and end (older)."""
    session = requests.Session()
    session.headers.update(HEADERS)
    continue_token = {}
    for _ in range(MAX_PAGES):
        params = {
            "action": "query",
            "list": "recentchanges",
            "format": "json",
            "rcnamespace": 0,  # article edits only (skip talk/user pages)
            "rctype": "edit|new",
            "rcprop": "title|timestamp|user|ids|sizes|flags|comment",
            "rclimit": "500",
            "rcstart": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "rcend": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            **continue_token,
        }
        data = session.get(API_URL, params=params, timeout=30).json()
        yield from data.get("query", {}).get("recentchanges", [])
        continue_token = data.get("continue", {})
        if not continue_token:
            return


def main():
    now = datetime.now(timezone.utc)
    producer = Producer({
        "bootstrap.servers": os.environ["REDPANDA_BROKER"],
        "security.protocol": "SASL_SSL",
        "sasl.mechanisms": "SCRAM-SHA-256",
        "sasl.username": os.environ["REDPANDA_USER"],
        "sasl.password": os.environ["REDPANDA_PASSWORD"],
    })

    total = 0
    for rc in fetch_window(now, now - timedelta(minutes=LOOKBACK_MIN)):
        event = {
            "rcid": rc["rcid"],
            "title": rc.get("title"),
            "user": rc.get("user"),
            "timestamp": rc["timestamp"],  # e.g. 2026-09-27T06:30:00Z
            "type": rc.get("type"),        # edit | new
            # MediaWiki flags come as "" when set and absent when unset
            "bot": "bot" in rc,
            "delta": (rc.get("newlen", 0) or 0) - (rc.get("oldlen", 0) or 0),
            "comment": (rc.get("comment") or "")[:200],
        }
        # key=rcid -> same edit always lands on the same partition
        producer.produce(TOPIC, key=str(event["rcid"]), value=json.dumps(event))
        total += 1
        producer.poll(0)

    remaining = producer.flush(30)
    print(f"window_min={LOOKBACK_MIN} produced={total} undelivered={remaining}")
    sys.exit(1 if remaining else 0)


if __name__ == "__main__":
    main()
