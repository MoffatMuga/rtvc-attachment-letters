import type { NextRequest } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { ILO_EMAIL, sendMail } from "@/lib/mail";
import { ValidationError, courseLabel, validateRequest } from "@/lib/rules";

// Simple in-memory limit: 10 submissions per IP per hour.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (limited(ip)) {
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

  await ensureDb();
  // Block duplicate pending requests for the same admission number.
  const dup = await db().execute({
    sql: "SELECT id FROM requests WHERE adm_no = ? AND status = 'pending'",
    args: [clean.adm_no],
  });
  if (dup.rows.length) {
    return Response.json(
      { error: "A request for this admission number is already waiting for approval." },
      { status: 409 },
    );
  }
  await db().execute({
    sql: `INSERT INTO requests (created_at, name, adm_no, email, phone, course, section, cycle, level, module, start_month, start_year)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      new Date().toISOString(), clean.name, clean.adm_no, clean.email, clean.phone, clean.course,
      clean.section, clean.cycle, clean.level, clean.module, clean.start_month, clean.start_year,
    ],
  });

  const base = process.env.APP_URL || "";
  try {
    await sendMail({
      to: ILO_EMAIL(),
      subject: `New attachment letter request: ${clean.name}`,
      text:
        `${clean.name} (${clean.adm_no}) has requested an attachment letter.\n` +
        `${courseLabel(clean.course, clean.section)}, Level ${clean.level}${clean.module ? `, Module ${clean.module}` : ""}.\n` +
        `Trainee email: ${clean.email}\nPhone: ${clean.phone}\n\nReview and approve: ${base}/admin\n`,
    });
  } catch (e) {
    console.error("Could not notify ILO", e);
  }
  return Response.json({ ok: true });
}
