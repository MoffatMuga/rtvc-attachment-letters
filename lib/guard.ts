import { promises as dns } from "dns";
import type { NextRequest } from "next/server";
import { db, ensureDb } from "./db";

import { emailKey } from "./guard-email";
export { emailKey };

export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "10minutemail.com", "10minutemail.net",
  "tempmail.com", "temp-mail.org", "yopmail.com", "trashmail.com", "throwawaymail.com", "getnada.com",
  "sharklasers.com", "dispostable.com", "maildrop.cc", "fakeinbox.com", "mailnesia.com", "mohmal.com",
  "tempmailo.com", "emailondeck.com", "mintemail.com", "spamgourmet.com", "moakt.com",
]);
export const isDisposable = (email: string) => DISPOSABLE.has(email.slice(email.lastIndexOf("@") + 1).toLowerCase());

/**
 * Does the part after the @ exist and accept mail? Only rejects when DNS clearly says
 * "no such domain", so a slow or broken lookup never blocks a real trainee.
 */
const KNOWN_GOOD = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com",
  "proton.me", "protonmail.com", "yahoo.co.uk", "msn.com",
]);
let dnsWorks: boolean | null = null;

/** If even gmail.com cannot be looked up, DNS itself is unusable here, so we must not judge anyone. */
async function dnsUsable(): Promise<boolean> {
  if (dnsWorks === null) {
    try { await dns.resolveMx("gmail.com"); dnsWorks = true; }
    catch (e) { dnsWorks = !["ENOTFOUND", "ENODATA", "ECONNREFUSED", "ETIMEOUT", "ESERVFAIL", "EAI_AGAIN"].includes((e as { code?: string })?.code ?? ""); }
  }
  return dnsWorks;
}

export function _resetDnsCheck() { dnsWorks = null; }

export async function mailDomainExists(email: string): Promise<boolean> {
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (KNOWN_GOOD.has(domain)) return true;
  if (!(await dnsUsable())) return true;
  const withTimeout = <T,>(p: Promise<T>) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), 3000))]);
  const gone = (e: unknown) => ["ENOTFOUND", "ENODATA"].includes((e as { code?: string })?.code ?? "");
  try {
    const mx = await withTimeout(dns.resolveMx(domain));
    if (mx.some((r) => r.exchange && r.exchange !== ".")) return true;
    return false; // null MX
  } catch (e) {
    if (!gone(e)) return true;
  }
  try {
    await withTimeout(dns.resolve4(domain)); // no MX: mail may go to the A record
    return true;
  } catch (e) {
    return !gone(e);
  }
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

// ---------- rate limiting (stored in the database, so it works on Vercel) ----------
export async function hitCount(key: string, windowSec: number): Promise<number> {
  await ensureDb();
  const since = Math.floor(Date.now() / 1000) - windowSec;
  const r = await db().execute({ sql: "SELECT COUNT(*) AS n FROM hits WHERE key = ? AND ts > ?", args: [key, since] });
  return Number(r.rows[0].n);
}

export async function addHit(key: string) {
  await ensureDb();
  const now = Math.floor(Date.now() / 1000);
  await db().execute({ sql: "INSERT INTO hits (key, ts) VALUES (?, ?)", args: [key, now] });
  if (Math.random() < 0.02) await db().execute({ sql: "DELETE FROM hits WHERE ts < ?", args: [now - 86400] });
}

/** Counts this call and returns true if the limit is already used up. */
export async function tooMany(key: string, max: number, windowSec: number): Promise<boolean> {
  if ((await hitCount(key, windowSec)) >= max) return true;
  await addHit(key);
  return false;
}

// ---------- one email <-> one admission number ----------
/**
 * Finds why this admission number / email pair clashes with an existing trainee or
 * non-rejected request. Returns null when it is fine.
 */
export async function identityConflict(
  adm_no: string,
  email: string,
): Promise<{ kind: "adm" | "email"; hint?: string } | null> {
  await ensureDb();
  const key = emailKey(email);
  for (const table of ["trainees", "requests"]) {
    const where = table === "requests" ? " AND status != 'rejected'" : "";
    // this admission number already belongs to a different mailbox
    const a = await db().execute({
      sql: `SELECT email FROM ${table} WHERE adm_no = ? AND email_key != ?${where} LIMIT 1`,
      args: [adm_no, key],
    });
    if (a.rows.length) return { kind: "adm", hint: maskEmail(String(a.rows[0].email)) };
    // this mailbox already belongs to a different admission number
    const b = await db().execute({
      sql: `SELECT adm_no FROM ${table} WHERE email_key = ? AND adm_no != ?${where} LIMIT 1`,
      args: [key, adm_no],
    });
    if (b.rows.length) return { kind: "email" };
  }
  return null;
}
