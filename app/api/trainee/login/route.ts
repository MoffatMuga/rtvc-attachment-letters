import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, tooMany } from "@/lib/guard";
import { checkLoginCode, makeTraineeToken, TRAINEE_COOKIE, traineeCookieOptions } from "@/lib/trainee-auth";
import { getTraineeByEmail } from "@/lib/trainees";

export async function POST(req: NextRequest) {
  if (await tooMany(`login:ip:${clientIp(req)}`, 100, 900)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const code = String(body?.code ?? "").trim();
  const t = /^\d{6}$/.test(code) ? await getTraineeByEmail(email) : null;
  if (!t || !(await checkLoginCode(t.email, code))) {
    return Response.json({ error: "That code is wrong or has expired." }, { status: 401 });
  }
  await db().execute({
    sql: "UPDATE trainees SET last_login_at = ? WHERE id = ?",
    args: [new Date().toISOString(), t.id],
  });
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${TRAINEE_COOKIE}=${makeTraineeToken(t.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${traineeCookieOptions.maxAge}${traineeCookieOptions.secure ? "; Secure" : ""}`,
  );
  return res;
}
