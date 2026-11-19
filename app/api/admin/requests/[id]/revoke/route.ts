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

  const origin = (process.env.APP_URL || new URL(req.url).origin).replace(/\/+$/, "");
  let emailed = false;
  try {
    await sendMail({
      to: row.email,
      subject: `Attachment letter ${row.ref ?? ""} withdrawn - please apply again`.replace("  ", " "),
      text:
        `Dear ${row.name},\n\nThe attachment letter we sent you${row.ref ? ` (${row.ref})` : ""} has been withdrawn. Please do not use it.\n\n` +
        `Reason: ${why}\n\nPlease submit a new request with the correct details here:\n${origin}\n\n` +
        `ILO Connect\nIndustrial Liaison Office, Rangwe Technical and Vocational College`,
    });
    emailed = true;
  } catch (e) {
    console.error("Withdraw email failed", e);
  }
  return Response.json({ ok: true, emailed });
}
