// WikiPulse heartbeat — a Netlify Scheduled Function that pings GitHub's
// repository_dispatch API every 30 minutes. GitHub drops most *scheduled*
// workflow runs at high load, but API-triggered runs are never dropped —
// this keeps the pipeline's cadence reliable.
//
// Cadence was 10 min until 2026-10-06: each pipeline run wakes the Neon
// compute for ~5 min (autosuspend), so 144 runs/day burned ~13 compute-hours
// and exhausted the free-tier quota within days. 30 min keeps the same
// 1-minute aggregation windows (a run just covers 30 min of events).
//
// Requires HEARTBEAT_PAT (fine-grained PAT: repo wikpulse, Actions RW)
// in the Netlify site's environment.

export const config = {
  schedule: "4,34 * * * *", // every 30 min, off-peak minutes (UTC)
};

export default async () => {
  const token = process.env.HEARTBEAT_PAT;
  if (!token) {
    return new Response("HEARTBEAT_PAT not set — add it in Netlify site settings", { status: 500 });
  }

  try {
    const res = await fetch("https://api.github.com/repos/vinn27/wikpulse/dispatches", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "wikpulse-heartbeat",
      },
      body: JSON.stringify({ event_type: "tick" }),
    });

    // 204 = dispatch accepted; 409 = a run is already queued (fine, skip)
    const ok = res.ok || res.status === 409;
    console.log(`heartbeat dispatch -> ${res.status}`);
    return new Response(`heartbeat: ${res.status}`, { status: ok ? 200 : 502 });
  } catch (err) {
    console.error("heartbeat failed:", err);
    return new Response(`heartbeat error: ${String(err)}`, { status: 502 });
  }
};
