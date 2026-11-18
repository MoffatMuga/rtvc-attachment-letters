export const INSURANCE_MAX_BYTES = 4 * 1024 * 1024; // keeps each upload under Vercel's 4.5 MB request limit

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();
export const mimeFor = (name: string) => TYPES[extOf(name)] ?? null;

/** Checks the first bytes really match the file type, so a renamed file is refused. */
export function looksLike(mime: string, b: Buffer): boolean {
  if (mime === "application/pdf") return b.subarray(0, 1024).includes("%PDF-");
  if (mime === "image/png") return b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (mime === "image/jpeg") return b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  return false;
}

export const safeFileName = (n: string) =>
  n.replace(/[^\w.\- ()]/g, "_").replace(/\s+/g, " ").trim().slice(0, 100) || "insurance-letter.pdf";
