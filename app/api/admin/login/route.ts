import type { NextRequest } from "next/server";
import { addHit, clientIp, hitCount } from "@/lib/guard";
import { COOKIE, cookieOptions, makeToken, passwordOk } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  const key = `admin:${clientIp(req)}`;
  if ((await hitCount(key, 900)) >= 10) {
    return Response.json({ error: "Too many wrong attempts. Wait 15 minutes and try again." }, { status: 429 });
  }
  if (!passwordOk(String(password ?? ""))) {
    await addHit(key);
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${COOKIE}=${makeToken()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${cookieOptions.maxAge}${cookieOptions.secure ? "; Secure" : ""}`,
  );
  return res;
}
