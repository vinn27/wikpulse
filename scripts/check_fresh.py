import datetime
import os

import psycopg2
from dotenv import load_dotenv

load_dotenv(r"C:\Users\vinit\wikpulse\.env")
c = psycopg2.connect(os.environ["DATABASE_URL"])
cur = c.cursor()
cur.execute("SELECT max(window_start), count(*) FROM edit_windows")
newest, total = cur.fetchone()
cur.execute("SELECT count(*) FROM edit_windows WHERE window_start > now() - interval '1 hour'")
last_hour = cur.fetchone()[0]
print(f"newest window (UTC): {newest} | total: {total} | windows in last 1h: {last_hour}")
print(f"stale by: {round((datetime.datetime.now(datetime.timezone.utc) - newest).total_seconds() / 60)} min")
