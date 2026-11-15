import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { db, ensureDb } from "./db";
import { sendMail } from "./mail";
import { getTrainee, type Trainee } from "./trainees";

export const TRAINEE_COOKIE = "trainee_session";
const SESSION_S = 60 * 60 * 24 * 14; // 14 days
const CODE_TTL_S = 10 * 60;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET must be set (16+ characters).");
  return s;
}
const sign = (p: string) => createHmac("sha256", secret()).update("trainee:" + p).digest("base64url");
const hashCode = (email: string, code: string) =>
  createHash("sha256").update(`${secret()}:${email.toLowerCase()}:${code}`).digest("hex");

export const traineeCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_S,
};

export function makeTraineeToken(id: number) {
  const payload = `${id}.${Math.floor(Date.now() / 1000) + SESSION_S}`;
  return `${payload}.${sign(payload)}`;
}

function readTraineeId(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(parts[1]) <= Date.now() / 1000) return null;
  const id = Number(parts[0]);
  return Number.isInteger(id) ? id : null;
}

/** The signed-in trainee, or null. */
export async function currentTrainee(req: NextRequest): Promise<Trainee | null> {
  const id = readTraineeId(req.cookies.get(TRAINEE_COOKIE)?.value);
  return id == null ? null : getTrainee(id);
}

/** Creates a code and emails it. Silent about whether the address exists. */
export async function sendLoginCode(email: string, traineeName: string) {
  await ensureDb();
  const now = Math.floor(Date.now() / 1000);
  const recent = await db().execute({
    sql: "SELECT COUNT(*) AS n FROM login_codes WHERE email = ? AND created_at > ?",
    args: [email.toLowerCase(), now - 3600],
  });
  if (Number(recent.rows[0].n) >= MAX_CODES_PER_HOUR) return "limited" as const;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db().execute({
    sql: "DELETE FROM login_codes WHERE email = ? AND expires_at < ?",
    args: [email.toLowerCase(), now],
  });
  await db().execute({
    sql: "INSERT INTO login_codes (email, code_hash, expires_at, attempts, created_at) VALUES (?,?,?,?,?)",
    args: [email.toLowerCase(), hashCode(email, code), now + CODE_TTL_S, 0, now],
  });
  await sendMail({
    to: email,
    subject: `Your RTVC login code: ${code}`,
    text:
      `Hello ${traineeName},\n\nYour one-time login code is ${code}\n` +
      `It works for 10 minutes. If you did not ask for it, ignore this email.\n\n` +
      `ILO Connect\nIndustrial Liaison Office, Rangwe Technical and Vocational College`,
  });
  return "sent" as const;
}

/** Checks the newest code for this email. Returns true and burns it on success. */
export async function checkLoginCode(email: string, code: string): Promise<boolean> {
  await ensureDb();
  const now = Math.floor(Date.now() / 1000);
  const r = await db().execute({
    sql: "SELECT * FROM login_codes WHERE email = ? ORDER BY id DESC LIMIT 1",
    args: [email.toLowerCase()],
  });
  const row = r.rows[0];
  if (!row || Number(row.expires_at) < now || Number(row.attempts) >= MAX_ATTEMPTS) return false;
  await db().execute({ sql: "UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?", args: [row.id] });
  const a = Buffer.from(String(row.code_hash));
  const b = Buffer.from(hashCode(email, code.trim()));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  await db().execute({ sql: "DELETE FROM login_codes WHERE email = ?", args: [email.toLowerCase()] });
  return true;
}
