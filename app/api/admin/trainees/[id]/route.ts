import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { getAssessor, getTrainee } from "@/lib/trainees";

/** Assign (or clear) a trainee's assessor. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const t = await getTrainee(Number((await params).id));
  if (!t) return Response.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const aid = b?.assessor_id == null || b.assessor_id === "" ? null : Number(b.assessor_id);
  const assessor = await getAssessor(aid);
  if (aid != null && !assessor) return Response.json({ error: "Assessor not found" }, { status: 404 });

  await db().execute({
    sql: "UPDATE trainees SET assessor_id = ?, assigned_at = ? WHERE id = ?",
    args: [aid, aid == null ? null : new Date().toISOString(), t.id],
  });

  let emailed = false;
  if (assessor && t.assessor_id !== assessor.id && b?.notify !== false) {
    try {
      await sendMail({
        to: t.email,
        subject: "Your assessor has been assigned - Rangwe TVC",
        text:
          `Dear ${t.name},\n\nYour attachment assessor is ${assessor.name}` +
          `${assessor.department ? ` (${assessor.department})` : ""}.\n` +
          `${assessor.phone ? `Phone: ${assessor.phone}\n` : ""}${assessor.email ? `Email: ${assessor.email}\n` : ""}` +
          `\nLog in to see this and to update your firm details: ${process.env.APP_URL || ""}/trainee\n\n` +
          `ILO Connect\nIndustrial Liaison Office, Rangwe Technical and Vocational College`,
      });
      emailed = true;
    } catch (e) {
      console.error("Assessor email failed", e);
    }
  }
  return Response.json({ ok: true, emailed });
}
