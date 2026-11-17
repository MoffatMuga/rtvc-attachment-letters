/** Turns 0712345678, +254 712 345 678 or 254712345678 into 254712345678. Empty if not usable. */
export function waNumber(raw: string | undefined): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^0[17]\d{8}$/.test(d)) d = "254" + d.slice(1); // Kenyan local format
  if (/^[17]\d{8}$/.test(d)) d = "254" + d;           // missing the leading 0
  return d.length >= 9 ? d : "";
}

import { getSetting } from "./db";

/** The number set in the ILO settings page wins; the ILO_WHATSAPP environment setting is the fallback. */
export async function getWhatsapp(): Promise<string> {
  try {
    const saved = await getSetting("whatsapp");
    if (saved !== null) return waNumber(saved);
  } catch (e) {
    console.error("Could not read WhatsApp setting", e);
  }
  return waNumber(process.env.ILO_WHATSAPP);
}
