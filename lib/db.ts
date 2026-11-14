import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "fs";
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
      ]);
      // Upgrade older databases that were created before the phone column.
      const cols = await c.execute("PRAGMA table_info(requests)");
      if (!cols.rows.some((r) => String(r.name) === "phone")) {
        await c.execute("ALTER TABLE requests ADD COLUMN phone TEXT");
      }
      if (!cols.rows.some((r) => String(r.name) === "section")) {
        await c.execute("ALTER TABLE requests ADD COLUMN section TEXT");
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
