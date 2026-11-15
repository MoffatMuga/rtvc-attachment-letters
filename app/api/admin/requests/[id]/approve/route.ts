import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { allocateRef, db, getRequest } from "@/lib/db";
import { loadAssets } from "@/lib/letter-assets";
import { loadNita } from "@/lib/nita";
import { ILO_EMAIL, sendMail } from "@/lib/mail";
import { generateLetter } from "@/lib/pdf";
import { courseLabel, periodText } from "@/lib/rules";
import { letterSentSms, sendSms } from "@/lib/sms";
import { upsertTraineeFromRequest } from "@/lib/trainees";
import { buildLog } from "@/lib/xlsx";

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

  // Reuse the reference if an earlier attempt allocated one but email failed.
  let ref = row.ref;
  if (!ref) {
    ref = await allocateRef();
    await db().execute({ sql: "UPDATE requests SET ref = ? WHERE id = ?", args: [ref, row.id] });
  }
  const now = new Date();
  const pdf = await generateLetter(row, ref, now, await loadAssets());
  const filename = `Attachment letter - ${row.name} - ${ref.replaceAll("/", "-")}.pdf`;
  const [start, end] = periodText(row.start_month, row.start_year);
  // The NITA form (if the ILO uploaded one) goes to the trainee with the letter.
  const nita = await loadNita().catch((e) => {
    console.error("Could not load NITA form", e);
    return null;
  });

  try {
    await sendMail({
      to: row.email,
      subject: "Your industrial attachment letter - Rangwe TVC",
      text:
        `Dear ${row.name},\n\nYour industrial attachment letter (${ref}) is attached.\n` +
        `Attachment period: ${start} to ${end}.\n\n` +
        (nita ? `Your NITA form is attached as well.\n` : ``) +
        `Take it to the firm you wish to join. Good luck!\n\n` +
        `Once you know your firm, log in at ${process.env.APP_URL || ""}/trainee with this email address ` +
        `(we send you a one-time code) to add your firm and supervisor details and to see your assessor.\n\n` +
        `ILO Connect\nIndustrial Liaison Office, Rangwe Technical and Vocational College`,
      attachments: [
        { filename, content: pdf },
        ...(nita ? [{ filename: nita.name, content: nita.content }] : []),
      ],
    });
  } catch (e) {
    console.error("Email to trainee failed", e);
    return Response.json(
      { error: "Could not email the trainee. Nothing was marked approved; try again." },
      { status: 502 },
    );
  }

  await db().execute({
    sql: "UPDATE requests SET status = 'approved', decided_at = ? WHERE id = ?",
    args: [now.toISOString(), row.id],
  });

  // The trainee gets an account (log in with a one-time code sent to this email).
  await upsertTraineeFromRequest(row).catch((e) => console.error("Could not create trainee account", e));

  // Copy to the ILO with the up-to-date Excel log.
  try {
    const log = await buildLog();
    await sendMail({
      to: ILO_EMAIL(),
      subject: `Approved: ${row.name} (${ref})`,
      text: `Letter sent to ${row.email} (phone ${row.phone}).\n${row.name}, ${row.adm_no}, ${courseLabel(row.course, row.section)} Level ${row.level}.\nThe updated log is attached.`,
      attachments: [
        { filename, content: pdf },
        { filename: "Attachment letters log.xlsx", content: log },
      ],
    });
  } catch (e) {
    console.error("ILO copy failed", e);
  }

  // Optional SMS to the trainee. Never blocks the approval.
  const sms = await sendSms(row.phone, letterSentSms(row.name, ref));
  return Response.json({ ok: true, ref, sms, nita: !!nita });
}
