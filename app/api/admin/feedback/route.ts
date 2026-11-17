import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ensureDb();
  const rows = await db().execute("SELECT id, created_at, rating, comment FROM feedback ORDER BY id DESC LIMIT 500");
  const stats = await db().execute("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM feedback");
  const dist = await db().execute("SELECT rating, COUNT(*) AS n FROM feedback GROUP BY rating");
  const counts: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const d of dist.rows) counts[String(d.rating)] = Number(d.n);
  return Response.json({
    count: Number(stats.rows[0].n),
    average: stats.rows[0].avg == null ? null : Math.round(Number(stats.rows[0].avg) * 10) / 10,
    counts,
    items: rows.rows.map((r) => ({ id: Number(r.id), created_at: String(r.created_at), rating: Number(r.rating), comment: String(r.comment) })),
  });
}
