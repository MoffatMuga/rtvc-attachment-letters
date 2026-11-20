import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, ensureDb, peekNextRef, toRow } from "@/lib/db";
import { admKey } from "@/lib/duelist";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ensureDb();
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const res = await db().execute({
    sql: "SELECT * FROM requests WHERE status = ? ORDER BY id DESC LIMIT 200",
    args: [status],
  });
  const dl = await db().execute("SELECT adm_key FROM due_list");
  const listed = new Set(dl.rows.map((x) => String(x.adm_key)));
  const listActive = listed.size > 0;
  return Response.json({
    requests: res.rows.map((r) => {
      const row = toRow(r as unknown as Record<string, unknown>);
      return { ...row, due: listActive ? listed.has(admKey(row.adm_no)) : null };
    }),
    nextRef: await peekNextRef(),
  });
}
