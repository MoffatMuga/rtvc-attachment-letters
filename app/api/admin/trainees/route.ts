import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { backfillTrainees, toTrainee } from "@/lib/trainees";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ensureDb();
  await backfillTrainees();
  const r = await db().execute(`SELECT t.*, a.name AS assessor_name FROM trainees t
    LEFT JOIN assessors a ON a.id = t.assessor_id ORDER BY t.id DESC LIMIT 500`);
  return Response.json({
    trainees: r.rows.map((x) => ({
      ...toTrainee(x as unknown as Record<string, unknown>),
      assessor_name: x.assessor_name == null ? null : String(x.assessor_name),
    })),
  });
}
