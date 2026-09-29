// WikiPulse heartbeat — a Netlify Scheduled Function that pings GitHub's
// repository_dispatch API every 10 minutes. GitHub drops most *scheduled*
// workflow runs at high load, but API-triggered runs are never dropped —
// this keeps the pipeline's 10-minute cadence reliable.
//
// Requires HEARTBEAT_PAT (fine-grained PAT: repo wikpulse, Actions RW)
// in the Netlify site's environment.

export const config = {
  schedule: "4,14,24,34,44,54 * * * *", // every 10 min, off-peak minutes (UTC)
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
