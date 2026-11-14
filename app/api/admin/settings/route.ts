import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import { loadPlacement } from "@/lib/letter-assets";
import { loadNita } from "@/lib/nita";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const [stamp, sig, placement, nita] = await Promise.all([
    getSetting("stamp_png"),
    getSetting("signature_png"),
    loadPlacement(),
    loadNita(),
  ]);
  return Response.json({
    stamp: stamp ? `data:image/png;base64,${stamp}` : null,
    signature: sig ? `data:image/png;base64,${sig}` : null,
    placement,
    nita: nita ? { name: nita.name, kb: Math.round(nita.content.length / 1024) } : null,
  });
}
