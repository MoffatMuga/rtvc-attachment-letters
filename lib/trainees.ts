import { db, ensureDb } from "./db";

export type Trainee = {
  id: number;
  created_at: string;
  adm_no: string;
  name: string;
  email: string;
  phone: string;
  assessor_id: number | null;
  assigned_at: string | null;
  firm_name: string;
  firm_location: string;
  firm_address: string;
  firm_phone: string;
  department_at_firm: string;
  supervisor_name: string;
  supervisor_title: string;
  supervisor_phone: string;
  supervisor_email: string;
  start_date: string;
  end_date: string;
  profile_updated_at: string | null;
  consent_at: string | null;
  last_login_at: string | null;
};

export type Assessor = { id: number; name: string; email: string; phone: string; department: string };

export const PROFILE_FIELDS = [
  "phone",
  "firm_name",
  "firm_location",
  "firm_address",
  "firm_phone",
  "department_at_firm",
  "supervisor_name",
  "supervisor_title",
  "supervisor_phone",
  "supervisor_email",
  "start_date",
  "end_date",
] as const;

const s = (v: unknown) => (v == null ? "" : String(v));
const sn = (v: unknown) => (v == null ? null : String(v));

export function toTrainee(r: Record<string, unknown>): Trainee {
  return {
    id: Number(r.id),
    created_at: s(r.created_at),
    adm_no: s(r.adm_no),
    name: s(r.name),
    email: s(r.email),
    phone: s(r.phone),
    assessor_id: r.assessor_id == null ? null : Number(r.assessor_id),
    assigned_at: sn(r.assigned_at),
    firm_name: s(r.firm_name),
    firm_location: s(r.firm_location),
    firm_address: s(r.firm_address),
    firm_phone: s(r.firm_phone),
    department_at_firm: s(r.department_at_firm),
    supervisor_name: s(r.supervisor_name),
    supervisor_title: s(r.supervisor_title),
    supervisor_phone: s(r.supervisor_phone),
    supervisor_email: s(r.supervisor_email),
    start_date: s(r.start_date),
    end_date: s(r.end_date),
    profile_updated_at: sn(r.profile_updated_at),
    consent_at: sn(r.consent_at),
    last_login_at: sn(r.last_login_at),
  };
}

export const toAssessor = (r: Record<string, unknown>): Assessor => ({
  id: Number(r.id),
  name: s(r.name),
  email: s(r.email),
  phone: s(r.phone),
  department: s(r.department),
});

/** Creates (or refreshes the contact details of) the account for an approved request. */
export async function upsertTraineeFromRequest(r: {
  adm_no: string;
  name: string;
  email: string;
  phone: string;
}) {
  await ensureDb();
  await db().execute({
    sql: `INSERT INTO trainees (created_at, adm_no, name, email, phone) VALUES (?,?,?,?,?)
          ON CONFLICT(adm_no) DO UPDATE SET email = excluded.email, name = excluded.name`,
    args: [new Date().toISOString(), r.adm_no, r.name, r.email, r.phone],
  });
}

/** Accounts for letters that were approved before accounts existed. */
export async function backfillTrainees() {
  await ensureDb();
  const res = await db().execute(
    "SELECT adm_no, name, email, phone FROM requests WHERE status = 'approved' ORDER BY id ASC",
  );
  for (const r of res.rows) {
    await upsertTraineeFromRequest({
      adm_no: s(r.adm_no),
      name: s(r.name),
      email: s(r.email),
      phone: s(r.phone),
    });
  }
}

export async function getTrainee(id: number): Promise<Trainee | null> {
  await ensureDb();
  const r = await db().execute({ sql: "SELECT * FROM trainees WHERE id = ?", args: [id] });
  return r.rows.length ? toTrainee(r.rows[0] as unknown as Record<string, unknown>) : null;
}

export async function getTraineeByEmail(email: string): Promise<Trainee | null> {
  await ensureDb();
  const r = await db().execute({
    sql: "SELECT * FROM trainees WHERE lower(email) = lower(?) ORDER BY id DESC LIMIT 1",
    args: [email.trim()],
  });
  return r.rows.length ? toTrainee(r.rows[0] as unknown as Record<string, unknown>) : null;
}

export async function getAssessor(id: number | null): Promise<Assessor | null> {
  if (id == null) return null;
  await ensureDb();
  const r = await db().execute({ sql: "SELECT * FROM assessors WHERE id = ?", args: [id] });
  return r.rows.length ? toAssessor(r.rows[0] as unknown as Record<string, unknown>) : null;
}
