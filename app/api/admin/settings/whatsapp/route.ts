import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/db";
import { getWhatsapp, waNumber } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return Response.json({ saved: (await getSetting("whatsapp")) ?? "", active: await getWhatsapp() });
}

/** Save the ILO WhatsApp number (any common format). An empty value hides the chat button. */
export async function PUT(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const raw = String(b?.number ?? "").trim();
  const n = raw ? waNumber(raw) : "";
  if (raw && !n) return Response.json({ error: "That number is not valid. Example: 0712 345 678" }, { status: 400 });
  await setSetting("whatsapp", n);
  return Response.json({ ok: true, active: n });
}
