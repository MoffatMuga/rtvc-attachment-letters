import type { NextRequest } from "next/server";
import { getRequest } from "@/lib/db";
import { loadAssets } from "@/lib/letter-assets";
import { generateLetter } from "@/lib/pdf";
import { currentTrainee } from "@/lib/trainee-auth";

/** A trainee can re-download only their own approved letters. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = await currentTrainee(req);
  if (!t) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const row = await getRequest(Number(id));
  if (!row || row.status !== "approved" || row.adm_no !== t.adm_no || !row.ref) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const pdf = await generateLetter(row, row.ref, new Date(row.decided_at ?? Date.now()), await loadAssets());
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Attachment letter - ${row.ref.replaceAll("/", "-")}.pdf"`,
    },
  });
}
