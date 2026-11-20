import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "fs";
import { emailKey } from "./guard-email";
import path from "path";

let client: Client | null = null;
let ready: Promise<void> | null = null;

export function db(): Client {
  if (!client) {
    const url = process.env.DATABASE_URL || "file:data/app.db";
    if (url.startsWith("file:")) {
      mkdirSync(path.dirname(path.resolve(url.slice(5))), { recursive: true });
    }
    client = createClient({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    });
  }
  return client;
}

/** Create tables on first use. Await this before querying. */
export function ensureDb(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const c = db();
      await c.batch([
        `CREATE TABLE IF NOT EXISTS requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          created_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          name TEXT NOT NULL,
          adm_no TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT,
          course TEXT NOT NULL,
          section TEXT,
          cycle TEXT NOT NULL,
          level TEXT NOT NULL,
          module TEXT NOT NULL,
          start_month INTEGER NOT NULL,
          start_year INTEGER NOT NULL,
          ref TEXT,
          decided_at TEXT,
          reject_reason TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`,
        `INSERT OR IGNORE INTO settings (key, value) VALUES ('last_ref_no', '0')`,
        `CREATE TABLE IF NOT EXISTS assessors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          department TEXT NOT NULL DEFAULT ''
        )`,
        `CREATE TABLE IF NOT EXISTS trainees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          created_at TEXT NOT NULL,
          adm_no TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '',
          assessor_id INTEGER,
          assigned_at TEXT,
          firm_name TEXT NOT NULL DEFAULT '',
          firm_location TEXT NOT NULL DEFAULT '',
          firm_address TEXT NOT NULL DEFAULT '',
          firm_phone TEXT NOT NULL DEFAULT '',
          department_at_firm TEXT NOT NULL DEFAULT '',
          supervisor_name TEXT NOT NULL DEFAULT '',
          supervisor_title TEXT NOT NULL DEFAULT '',
          supervisor_phone TEXT NOT NULL DEFAULT '',
          supervisor_email TEXT NOT NULL DEFAULT '',
          start_date TEXT NOT NULL DEFAULT '',
          end_date TEXT NOT NULL DEFAULT '',
          profile_updated_at TEXT,
          consent_at TEXT,
          last_login_at TEXT
        )`,
        `CREATE INDEX IF NOT EXISTS trainees_email_idx ON trainees (email)`,
        `CREATE TABLE IF NOT EXISTS login_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          code_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )`,
      ]);
      await c.batch([
        `CREATE TABLE IF NOT EXISTS hits (key TEXT NOT NULL, ts INTEGER NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS insurance_letters (
          trainee_id INTEGER PRIMARY KEY,
          file_name TEXT NOT NULL,
          mime TEXT NOT NULL,
          size INTEGER NOT NULL,
          content TEXT NOT NULL,
          uploaded_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS due_list (
          adm_key TEXT PRIMARY KEY,
          adm_no TEXT NOT NULL,
          name TEXT NOT NULL,
          department TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          created_at TEXT NOT NULL,
          rating INTEGER NOT NULL,
          comment TEXT NOT NULL DEFAULT ''
        )`,
        `CREATE INDEX IF NOT EXISTS hits_key_idx ON hits (key, ts)`,
      ]);
      // Upgrade older databases that were created before the phone column.
      const cols = await c.execute("PRAGMA table_info(requests)");
      if (!cols.rows.some((r) => String(r.name) === "phone")) {
        await c.execute("ALTER TABLE requests ADD COLUMN phone TEXT");
      }
      if (!cols.rows.some((r) => String(r.name) === "section")) {
        await c.execute("ALTER TABLE requests ADD COLUMN section TEXT");
      }
      // One email <-> one admission number: a normalised email key on both tables.
      for (const table of ["requests", "trainees"]) {
        const tc = await c.execute(`PRAGMA table_info(${table})`);
        if (!tc.rows.some((r) => String(r.name) === "email_key")) {
          await c.execute(`ALTER TABLE ${table} ADD COLUMN email_key TEXT NOT NULL DEFAULT ''`);
        }
        const missing = await c.execute(`SELECT id, email FROM ${table} WHERE email_key = ''`);
        for (const r of missing.rows) {
          await c.execute({
            sql: `UPDATE ${table} SET email_key = ? WHERE id = ?`,
            args: [emailKey(String(r.email)), r.id as number],
          });
        }
      }
      // Database-level guards. Wrapped so old duplicate data can never stop the app starting.
      for (const sql of [
        `CREATE INDEX IF NOT EXISTS requests_adm_idx ON requests (adm_no)`,
        `CREATE INDEX IF NOT EXISTS requests_emailkey_idx ON requests (email_key)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS one_pending_per_adm ON requests (adm_no) WHERE status = 'pending'`,
        `CREATE UNIQUE INDEX IF NOT EXISTS trainees_emailkey_uq ON trainees (email_key)`,
      ]) {
        await c.execute(sql).catch((e) => console.error("Could not create index (existing duplicates?):", sql, e.message));
      }
    })();
  }
  return ready;
}

export async function getSetting(key: string): Promise<string | null> {
  await ensureDb();
  const r = await db().execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [key] });
  return r.rows.length ? String(r.rows[0].value) : null;
}

export async function setSetting(key: string, value: string) {
  await ensureDb();
  await db().execute({
    sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [key, value],
  });
}

export async function deleteSetting(key: string) {
  await ensureDb();
  await db().execute({ sql: "DELETE FROM settings WHERE key = ?", args: [key] });
}

export const REF_PREFIX = "RTVC/ILO/01";

/** Atomically take the next reference number. */
export async function allocateRef(): Promise<string> {
  await ensureDb();
  const r = await db().execute(
    "UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'last_ref_no' RETURNING value",
  );
  const n = Number(r.rows[0].value);
  return `${REF_PREFIX}/${String(n).padStart(3, "0")}`;
}

export async function peekNextRef(): Promise<string> {
  const last = Number((await getSetting("last_ref_no")) ?? "0");
  return `${REF_PREFIX}/${String(last + 1).padStart(3, "0")}`;
}

export type RequestRow = {
  id: number;
  created_at: string;
  status: "pending" | "approved" | "rejected";
  name: string;
  adm_no: string;
  email: string;
  phone: string;
  course: string;
  section: string;
  cycle: string;
  level: string;
  module: string;
  start_month: number;
  start_year: number;
  ref: string | null;
  decided_at: string | null;
  reject_reason: string | null;
};

export function toRow(r: Record<string, unknown>): RequestRow {
  return {
    id: Number(r.id),
    created_at: String(r.created_at),
    status: String(r.status) as RequestRow["status"],
    name: String(r.name),
    adm_no: String(r.adm_no),
    email: String(r.email),
    phone: r.phone == null ? "" : String(r.phone),
    course: String(r.course),
    section: r.section == null ? "" : String(r.section),
    cycle: String(r.cycle),
    level: String(r.level),
    module: String(r.module),
    start_month: Number(r.start_month),
    start_year: Number(r.start_year),
    ref: r.ref == null ? null : String(r.ref),
    decided_at: r.decided_at == null ? null : String(r.decided_at),
    reject_reason: r.reject_reason == null ? null : String(r.reject_reason),
  };
}

export async function getRequest(id: number): Promise<RequestRow | null> {
  await ensureDb();
  const r = await db().execute({ sql: "SELECT * FROM requests WHERE id = ?", args: [id] });
  return r.rows.length ? toRow(r.rows[0] as unknown as Record<string, unknown>) : null;
}
