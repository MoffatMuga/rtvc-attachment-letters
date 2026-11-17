import type { NextRequest } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { clientIp, emailKey, identityConflict, isDisposable, mailDomainExists, tooMany } from "@/lib/guard";
import { ILO_EMAIL, sendMail } from "@/lib/mail";
import { ValidationError, courseLabel, validateRequest } from "@/lib/rules";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (await tooMany(`req:ip:${ip}`, 60, 3600)) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (body.website) {
    // Honeypot field filled in: pretend success.
    return Response.json({ ok: true });
  }
  let clean;
  try {
    clean = validateRequest(body);
  } catch (e) {
    if (e instanceof ValidationError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  const key = emailKey(clean.email);

  // Real, permanent email addresses only.
  if (isDisposable(clean.email)) {
    return Response.json({ error: "Please use a permanent email address, not a temporary one." }, { status: 400 });
  }
  if (!(await mailDomainExists(clean.email))) {
    return Response.json({ error: "That email domain does not exist. Check the spelling after the @." }, { status: 400 });
  }

  if (await tooMany(`req:email:${key}`, 6, 3600)) {
    return Response.json({ error: "Too many requests for this email. Try again later." }, { status: 429 });
  }

  await ensureDb();
  // One email <-> one admission number.
  const clash = await identityConflict(clean.adm_no, clean.email);
  if (clash?.kind === "adm") {
    return Response.json(
      { error: `This admission number is already registered with another email (${clash.hint}). Use that email, or contact the ILO to change it.` },
      { status: 409 },
    );
  }
  if (clash?.kind === "email") {
    return Response.json(
      { error: "This email is already used by another trainee. Each trainee needs their own email address." },
      { status: 409 },
    );
  }
  // Already holds this exact letter?
  const have = await db().execute({
    sql: `SELECT id FROM requests WHERE adm_no = ? AND status = 'approved' AND cycle = ? AND level = ? AND module = ? LIMIT 1`,
    args: [clean.adm_no, clean.cycle, clean.level, clean.module],
  });
  if (have.rows.length) {
    return Response.json(
      { error: "You already have an approved letter for this cycle and level. Log in as a trainee to download it again." },
      { status: 409 },
    );
  }
  // Block duplicate pending requests for the same admission number.
  const dup = await db().execute({
    sql: "SELECT id FROM requests WHERE adm_no = ? AND status = 'pending'",
    args: [clean.adm_no],
  });
  const pending409 = () => Response.json(
    { error: "A request for this admission number is already waiting for approval." },
    { status: 409 },
  );
  if (dup.rows.length) return pending409();
  try {
    await db().execute({
      sql: `INSERT INTO requests (created_at, name, adm_no, email, email_key, phone, course, section, cycle, level, module, start_month, start_year)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        new Date().toISOString(), clean.name, clean.adm_no, clean.email, key, clean.phone, clean.course,
        clean.section, clean.cycle, clean.level, clean.module, clean.start_month, clean.start_year,
      ],
    });
  } catch (e) {
    // Two clicks at the same moment: the database's own guard catches the second.
    if (/UNIQUE|constraint/i.test((e as Error).message)) return pending409();
    throw e;
  }

  const base = process.env.APP_URL || "";
  try {
    await sendMail({
      to: ILO_EMAIL(),
      subject: `New attachment letter request: ${clean.name}`,
      text:
        `${clean.name} (${clean.adm_no}) has requested an attachment letter.\n` +
        `${courseLabel(clean.course, clean.section, clean.cycle, clean.level)}, Level ${clean.level}${clean.module ? `, Module ${clean.module}` : ""}.\n` +
        `Trainee email: ${clean.email}\nPhone: ${clean.phone}\n\nReview and approve: ${base}/admin\n`,
    });
  } catch (e) {
    console.error("Could not notify ILO", e);
  }
  return Response.json({ ok: true });
}
