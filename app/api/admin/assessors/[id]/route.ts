import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ensureDb();
  const id = Number((await params).id);
  // Trainees who had this assessor go back to "not yet assigned".
  await db().batch([
    { sql: "UPDATE trainees SET assessor_id = NULL, assigned_at = NULL WHERE assessor_id = ?", args: [id] },
    { sql: "DELETE FROM assessors WHERE id = ?", args: [id] },
  ]);
  return Response.json({ ok: true });
}
