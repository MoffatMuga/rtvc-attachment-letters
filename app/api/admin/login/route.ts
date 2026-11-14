import type { NextRequest } from "next/server";
import { COOKIE, cookieOptions, makeToken, passwordOk } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!passwordOk(String(password ?? ""))) {
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
