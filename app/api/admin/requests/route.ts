import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, ensureDb, peekNextRef, toRow } from "@/lib/db";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ensureDb();
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const res = await db().execute({
    sql: "SELECT * FROM requests WHERE status = ? ORDER BY id DESC LIMIT 200",
    args: [status],
  });
  return Response.json({
    requests: res.rows.map((r) => toRow(r as unknown as Record<string, unknown>)),
    nextRef: await peekNextRef(),
  });
}
