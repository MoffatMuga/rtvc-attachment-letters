import { waNumber } from "@/lib/whatsapp";

export const dynamic = "force-dynamic"; // read the setting on every visit, never a stale copy

/** Public settings the home page needs. Only the WhatsApp number, which is meant to be contacted. */
export async function GET() {
  return Response.json(
    { whatsapp: waNumber(process.env.ILO_WHATSAPP) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
