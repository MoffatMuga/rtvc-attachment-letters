import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setSetting } from "@/lib/db";
import { DEFAULT_PLACEMENT, type Placement } from "@/lib/pdf";

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const out: Record<string, number> = {};
  for (const key of Object.keys(DEFAULT_PLACEMENT) as (keyof Placement)[]) {
    const v = Number(body[key]);
    out[key] = Number.isFinite(v) ? v : DEFAULT_PLACEMENT[key];
  }
  out.stamp_width = Math.min(Math.max(out.stamp_width, 100), 260);
  out.date_size = Math.min(Math.max(out.date_size, 6), 16);
  await setSetting("placement", JSON.stringify(out));
  return Response.json({ ok: true });
}
