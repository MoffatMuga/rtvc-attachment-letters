import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getRequest, peekNextRef } from "@/lib/db";
import { loadAssets } from "@/lib/letter-assets";
import { generateLetter } from "@/lib/pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const row = await getRequest(Number(id));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  const pdf = await generateLetter(row, row.ref ?? (await peekNextRef()), new Date(), await loadAssets());
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=preview.pdf" },
  });
}
