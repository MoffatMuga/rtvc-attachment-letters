import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { INSURANCE_MAX_BYTES, looksLike, mimeFor, safeFileName } from "@/lib/insurance";
import { sendMail } from "@/lib/mail";
import { backfillTrainees, getTrainee } from "@/lib/trainees";

/** Every trainee, with their insurance letter if one is uploaded. */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ensureDb();
  await backfillTrainees();
  const r = await db().execute(`SELECT t.id, t.name, t.adm_no, t.email, i.file_name, i.size, i.uploaded_at
    FROM trainees t LEFT JOIN insurance_letters i ON i.trainee_id = t.id ORDER BY t.name`);
  return Response.json({
    trainees: r.rows.map((x) => ({
      id: Number(x.id), name: String(x.name), adm_no: String(x.adm_no), email: String(x.email),
      file_name: x.file_name == null ? null : String(x.file_name),
      size: x.size == null ? null : Number(x.size),
      uploaded_at: x.uploaded_at == null ? null : String(x.uploaded_at),
    })),
  });
}

/** Upload (or replace) one trainee's insurance letter. */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const traineeId = Number(form?.get("trainee_id"));
  const notify = form?.get("notify") === "1";
  if (!(file instanceof File) || !Number.isInteger(traineeId)) {
    return Response.json({ error: "Choose a file and a trainee." }, { status: 400 });
  }
  const t = await getTrainee(traineeId);
  if (!t) return Response.json({ error: "That trainee was not found." }, { status: 404 });
  const mime = mimeFor(file.name);
  if (!mime) return Response.json({ error: "Only PDF, JPG or PNG files are accepted." }, { status: 400 });
  if (file.size > INSURANCE_MAX_BYTES) return Response.json({ error: "File is larger than 4 MB." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!looksLike(mime, bytes)) return Response.json({ error: "The file is not a real " + mime.split("/")[1].toUpperCase() + "." }, { status: 400 });

  await ensureDb();
  await db().execute({
    sql: `INSERT INTO insurance_letters (trainee_id, file_name, mime, size, content, uploaded_at) VALUES (?,?,?,?,?,?)
          ON CONFLICT(trainee_id) DO UPDATE SET file_name = excluded.file_name, mime = excluded.mime,
          size = excluded.size, content = excluded.content, uploaded_at = excluded.uploaded_at`,
    args: [t.id, safeFileName(file.name), mime, bytes.length, bytes.toString("base64"), new Date().toISOString()],
  });

  let emailed = false;
  if (notify) {
    const origin = (process.env.APP_URL || new URL(req.url).origin).replace(/\/+$/, "");
    try {
      await sendMail({
        to: t.email,
        subject: "Your insurance letter is ready - Rangwe TVC",
        text:
          `Dear ${t.name},\n\nYour insurance letter is now available. Log in to download it:\n${origin}/trainee\n` +
          `(use this email address; we send you a one-time code).\n\nILO Connect\nIndustrial Liaison Office, Rangwe Technical and Vocational College`,
      });
      emailed = true;
    } catch (e) {
      console.error("Insurance email failed", e);
    }
  }
  return Response.json({ ok: true, emailed });
}

/** Remove a trainee's insurance letter (?trainee_id=). */
export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const id = Number(new URL(req.url).searchParams.get("trainee_id"));
  if (!Number.isInteger(id)) return Response.json({ error: "Missing trainee" }, { status: 400 });
  await ensureDb();
  await db().execute({ sql: "DELETE FROM insurance_letters WHERE trainee_id = ?", args: [id] });
  return Response.json({ ok: true });
}
