import type { NextRequest } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { clientIp, tooMany } from "@/lib/guard";
import { sendLoginCode } from "@/lib/trainee-auth";
import { getTraineeByEmail, upsertTraineeFromRequest } from "@/lib/trainees";

/** Always answers the same way, so nobody can test which emails have accounts. */
export async function POST(req: NextRequest) {
  if (await tooMany(`code:ip:${clientIp(req)}`, 60, 3600)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  try {
    let t = await getTraineeByEmail(email);
    if (!t) {
      // Letters approved before accounts existed: create the account now.
      await ensureDb();
      const r = await db().execute({
        sql: "SELECT adm_no, name, email, phone FROM requests WHERE status = 'approved' AND lower(email) = ? ORDER BY id DESC LIMIT 1",
        args: [email],
      });
      if (r.rows.length) {
        const x = r.rows[0];
        await upsertTraineeFromRequest({
          adm_no: String(x.adm_no), name: String(x.name), email: String(x.email), phone: String(x.phone ?? ""),
        });
        t = await getTraineeByEmail(email);
      }
    }
    if (t) await sendLoginCode(t.email, t.name);
  } catch (e) {
    console.error("Login code failed", e);
    return Response.json({ error: "Could not send the code. Try again shortly." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
