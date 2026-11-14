import { getSetting } from "./db";

export const NITA_MAX_BYTES = 4 * 1024 * 1024; // hosts like Vercel reject request bodies over 4.5 MB

export type NitaForm = { name: string; content: Buffer };

/** The NITA form PDF the ILO uploaded, or null if none. */
export async function loadNita(): Promise<NitaForm | null> {
  const b64 = await getSetting("nita_pdf");
  if (!b64) return null;
  return {
    name: (await getSetting("nita_name")) || "NITA form.pdf",
    content: Buffer.from(b64, "base64"),
  };
}

/** Keeps the uploaded file name but removes odd characters. Always ends in .pdf. */
export function safePdfName(name: string): string {
  const base = name
    .replace(/\.[^.]*$/, "")
    .replace(/[^\w .()-]+/g, "")
    .trim()
    .slice(0, 80);
  return `${base || "NITA form"}.pdf`;
}
