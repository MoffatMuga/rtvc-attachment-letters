import type { NextRequest } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { clientIp, tooMany } from "@/lib/guard";

/** Anonymous rating of the whole experience (1 to 5 stars) with an optional comment. */
export async function POST(req: NextRequest) {
  if (await tooMany(`fb:ip:${clientIp(req)}`, 20, 3600)) {
    return Response.json({ error: "Too many submissions. Try again later." }, { status: 429 });
  }
  const b = await req.json().catch(() => ({}));
  if (b?.website) return Response.json({ ok: true }); // honeypot
  const rating = Number(b?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: "Choose 1 to 5 stars." }, { status: 400 });
  }
  const comment = String(b?.comment ?? "").trim().replace(/\s+/g, " ").slice(0, 500);
  await ensureDb();
  await db().execute({
    sql: "INSERT INTO feedback (created_at, rating, comment) VALUES (?,?,?)",
    args: [new Date().toISOString(), rating, comment],
  });
  return Response.json({ ok: true });
}
