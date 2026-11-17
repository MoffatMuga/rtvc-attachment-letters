import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getWhatsapp } from "@/lib/whatsapp";
import { courseLabel, normalizePhone, periodText } from "@/lib/rules";
import { currentTrainee } from "@/lib/trainee-auth";
import { getAssessor, PROFILE_FIELDS } from "@/lib/trainees";
import { toRow } from "@/lib/db";

export async function GET(req: NextRequest) {
  const t = await currentTrainee(req);
  if (!t) return Response.json({ error: "Not signed in" }, { status: 401 });
  const assessor = await getAssessor(t.assessor_id);
  const res = await db().execute({
    sql: "SELECT * FROM requests WHERE status = 'approved' AND adm_no = ? ORDER BY id DESC",
    args: [t.adm_no],
  });
  const letters = res.rows.map((raw) => {
    const r = toRow(raw as unknown as Record<string, unknown>);
    const [s, e] = periodText(r.start_month, r.start_year);
    return {
      id: r.id,
      ref: r.ref,
      course: courseLabel(r.course, r.section, r.cycle, r.level),
      level: r.level,
      period: `${s} to ${e}`,
      date: (r.decided_at ?? "").slice(0, 10),
    };
  });
  const { assessor_id: _a, ...profile } = t;
  void _a;
  return Response.json({
    whatsapp: await getWhatsapp(),
    trainee: profile,
    assessor: assessor && { name: assessor.name, phone: assessor.phone, email: assessor.email, department: assessor.department },
    letters,
  });
}

const MAX = 150;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PUT(req: NextRequest) {
  const t = await currentTrainee(req);
  if (!t) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const v: Record<string, string> = {};
  for (const f of PROFILE_FIELDS) v[f] = String(body?.[f] ?? "").trim().replace(/\s+/g, " ").slice(0, MAX);

  const bad = (error: string) => Response.json({ error }, { status: 400 });
  if (!v.firm_name) return bad("Enter the name of the firm.");
  if (!v.firm_location) return bad("Enter the town or county where the firm is.");
  if (!v.supervisor_name) return bad("Enter your supervisor's name.");
  if (!v.supervisor_phone) return bad("Enter your supervisor's phone number.");
  for (const f of ["phone", "firm_phone", "supervisor_phone"] as const) {
    if (v[f]) {
      const n = normalizePhone(v[f]);
      if (!n) return bad("A phone number is not valid. Use a Kenyan number like 0712345678.");
      v[f] = n;
    }
  }
  if (v.supervisor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.supervisor_email)) {
    return bad("The supervisor's email is not valid.");
  }
  for (const f of ["start_date", "end_date"] as const) {
    if (v[f] && (!DATE_RE.test(v[f]) || Number.isNaN(Date.parse(v[f])))) return bad("A date is not valid.");
  }
  if (v.start_date && v.end_date && v.end_date < v.start_date) return bad("The end date is before the start date.");
  if (!t.consent_at && body?.consent !== true) {
    return bad("Please tick the box to agree to the data notice.");
  }

  const now = new Date().toISOString();
  await db().execute({
    sql: `UPDATE trainees SET ${PROFILE_FIELDS.map((f) => `${f} = ?`).join(", ")},
          profile_updated_at = ?, consent_at = COALESCE(consent_at, ?) WHERE id = ?`,
    args: [...PROFILE_FIELDS.map((f) => v[f]), now, now, t.id],
  });
  return Response.json({ ok: true });
}
