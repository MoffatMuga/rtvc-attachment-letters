import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";

/** Lets the admin shell know whether someone is signed in. */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true });
}
