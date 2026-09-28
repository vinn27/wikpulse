// Server-side data endpoint: reads Neon through a SELECT-only role.
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

type RawRow = Record<string, string | number | null>;

const iso = (v: unknown) => new Date(v as string).toISOString();
const num = (v: unknown) => Number(v ?? 0);

export async function GET() {
  const url = process.env.DATABASE_URL_RO;
  if (!url) {
    return Response.json({ error: "DATABASE_URL_RO not configured" }, { status: 500 });
  }
  try {
    const sql = neon(url);

    const minutes = await sql`
      SELECT window_start AS t, edits, bot_edits AS bot, human_edits AS human,
             unique_editors AS editors, new_pages AS newpages
      FROM edit_windows
      WHERE window_start > now() - interval '48 hours'
      ORDER BY window_start`;

    const hours = await sql`
      SELECT date_trunc('hour', window_start) AS t,
             sum(edits) AS edits, sum(bot_edits) AS bot, sum(human_edits) AS human,
             sum(unique_editors) AS editors, sum(new_pages) AS newpages
      FROM edit_windows
      WHERE window_start > now() - interval '7 days'
      GROUP BY 1 ORDER BY 1`;

    const pages = await sql`
      SELECT date_trunc('hour', window_start) AS hour, page_title AS title,
             sum(edits) AS edits, sum(net_bytes) AS netbytes
      FROM top_pages
      WHERE window_start > now() - interval '7 days'
      GROUP BY 1, 2 ORDER BY 1`;

    const norm = (r: RawRow) => ({
      t: iso(r.t),
      edits: num(r.edits),
      bot: num(r.bot),
      human: num(r.human),
      editors: num(r.editors),
      newPages: num(r.newpages),
    });

    return Response.json({
      minutes: (minutes as RawRow[]).map(norm),
      hours: (hours as RawRow[]).map(norm),
      pages: (pages as RawRow[]).map((r) => ({
        hour: iso(r.hour),
        title: String(r.title ?? ""),
        edits: num(r.edits),
        netBytes: num(r.netbytes),
      })),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
