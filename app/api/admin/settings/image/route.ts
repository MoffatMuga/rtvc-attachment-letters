import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteSetting, setSetting } from "@/lib/db";
import { cleanScan } from "@/lib/images";

const KEYS = { stamp: "stamp_png", signature: "signature_png" } as const;

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const form = await req.formData();
  const kind = String(form.get("kind"));
  const file = form.get("file");
  if (!(kind in KEYS) || !(file instanceof File)) {
    return Response.json({ error: "Choose a stamp or signature image." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return Response.json({ error: "Image is too large (max 8 MB)." }, { status: 400 });
  }
  try {
    const png = await cleanScan(Buffer.from(await file.arrayBuffer()));
    await setSetting(KEYS[kind as keyof typeof KEYS], png.toString("base64"));
  } catch {
    return Response.json({ error: "Could not read that image. Try a JPG or PNG." }, { status: 400 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const kind = req.nextUrl.searchParams.get("kind") ?? "";
  if (!(kind in KEYS)) return Response.json({ error: "Unknown image" }, { status: 400 });
  await deleteSetting(KEYS[kind as keyof typeof KEYS]);
  return Response.json({ ok: true });
}
