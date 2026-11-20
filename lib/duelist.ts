/** Admission numbers are compared ignoring case, spaces and punctuation: "ee/101/2024" = "EE 101 2024". */
export const admKey = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
