/** Public settings the home page needs. Only the WhatsApp number, which is meant to be contacted. */
export async function GET() {
  const wa = (process.env.ILO_WHATSAPP || "").replace(/\D/g, "");
  return Response.json({ whatsapp: wa.length >= 9 ? wa : "" });
}
