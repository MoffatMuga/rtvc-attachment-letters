import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, getRequest } from "@/lib/db";
import { sendMail } from "@/lib/mail";

/** Withdraw a letter that was approved by mistake or with wrong details. The trainee can then apply again. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const row = await getRequest(Number(id));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "approved") {
    return Response.json({ error: `Only approved letters can be withdrawn (this one is ${row.status}).` }, { status: 409 });
  }
  const { reason } = await req.json().catch(() => ({ reason: "" }));
  const why = String(reason ?? "").trim().slice(0, 400);
  if (!why) return Response.json({ error: "Write a short reason for the trainee." }, { status: 400 });

  await db().execute({
    sql: "UPDATE requests SET status = 'rejected', decided_at = ?, reject_reason = ? WHERE id = ?",
    args: [new Date().toISOString(), `Withdrawn: ${why}`, row.id],
  });

  // No other approved letter for this admission number? Then remove the trainee's account and everything on it
  // (profile, assessor link, insurance letter, login codes). They get a fresh account when the corrected letter is approved.
  let accountCleared = false;
  const others = await db().execute({
    sql: "SELECT 1 FROM requests WHERE adm_no = ? AND status = 'approved' LIMIT 1",
    args: [row.adm_no],
  });
  if (!others.rows.length) {
    const t = await db().execute({ sql: "SELECT id, email FROM trainees WHERE adm_no = ?", args: [row.adm_no] });
    const ids = t.rows.map((x) => Number(x.id));
    const emails = [...new Set([row.email, ...t.rows.map((x) => String(x.email))])];
    const stmts = [
      ...ids.map((id) => ({ sql: "DELETE FROM insurance_letters WHERE trainee_id = ?", args: [id] })),
      ...emails.map((e) => ({ sql: "DELETE FROM login_codes WHERE email = ?", args: [e] })),
      { sql: "DELETE FROM trainees WHERE adm_no = ?", args: [row.adm_no] },
    ];
    await db().batch(stmts, "write");
    accountCleared = ids.length > 0;
  }

  const origin = (process.env.APP_URL || new URL(req.url).origin).replace(/\/+$/, "");
  let emailed = false;
  try {
    await sendMail({
      to: row.email,
      subject: `Attachment letter ${row.ref ?? ""} withdrawn - please apply again`.replace("  ", " "),
      text:
        `Dear ${row.name},\n\nThe attachment letter we sent you${row.ref ? ` (${row.ref})` : ""} has been withdrawn. Please do not use it.\n\n` +
        `Reason: ${why}\n\nPlease submit a new request with the correct details here:\n${origin}\n\n` +
        (accountCleared ? `Your ILO Connect account has been reset. You will get a new login link when your corrected letter is approved.\n\n` : "") +
        `ILO Connect\nIndustrial Liaison Office, Rangwe Technical and Vocational College`,
    });
    emailed = true;
  } catch (e) {
    console.error("Withdraw email failed", e);
  }
  return Response.json({ ok: true, emailed, accountCleared });
}
