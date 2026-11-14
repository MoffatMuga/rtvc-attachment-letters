import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, getRequest } from "@/lib/db";
import { sendMail } from "@/lib/mail";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const row = await getRequest(Number(id));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "pending") {
    return Response.json({ error: `Request is already ${row.status}.` }, { status: 409 });
  }
  const { reason } = await req.json().catch(() => ({ reason: "" }));
  const why = String(reason ?? "").trim().slice(0, 300) || "Please check your details and apply again.";
  await db().execute({
    sql: "UPDATE requests SET status = 'rejected', decided_at = ?, reject_reason = ? WHERE id = ?",
    args: [new Date().toISOString(), why, row.id],
  });
  try {
    await sendMail({
      to: row.email,
      subject: "Your attachment letter request - Rangwe TVC",
      text: `Dear ${row.name},\n\nYour attachment letter request was not approved.\nReason: ${why}\n\nYou can submit a new request once this is sorted.\n\nIndustrial Liaison Office\nRangwe Technical and Vocational College`,
    });
  } catch (e) {
    console.error("Reject email failed", e);
  }
  return Response.json({ ok: true });
}
