import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteSetting, setSetting } from "@/lib/db";
import { NITA_MAX_BYTES, loadNita, safePdfName } from "@/lib/nita";

/** Upload or replace the NITA form (PDF). */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose the NITA form PDF." }, { status: 400 });
  }
  if (file.size > NITA_MAX_BYTES) {
    return Response.json({ error: "That PDF is too large (max 4 MB)." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  // A real PDF starts with %PDF- (within the first 1024 bytes).
  if (!bytes.subarray(0, 1024).includes("%PDF-")) {
    return Response.json({ error: "That file is not a PDF." }, { status: 400 });
  }
  await setSetting("nita_pdf", bytes.toString("base64"));
  await setSetting("nita_name", safePdfName(file.name));
  return Response.json({ ok: true });
}

/** View the stored NITA form. */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const nita = await loadNita();
  if (!nita) return Response.json({ error: "No NITA form uploaded." }, { status: 404 });
  return new Response(new Uint8Array(nita.content), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nita.name}"`,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await deleteSetting("nita_pdf");
  await deleteSetting("nita_name");
  return Response.json({ ok: true });
}
