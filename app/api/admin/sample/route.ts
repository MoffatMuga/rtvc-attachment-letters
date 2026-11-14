import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { peekNextRef } from "@/lib/db";
import { loadAssets } from "@/lib/letter-assets";
import { generateLetter } from "@/lib/pdf";

/** A sample letter so the ILO can check stamp and signature placement. */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const level = req.nextUrl.searchParams.get("level") === "6" ? "6" : "4";
  const pdf = await generateLetter(
    {
      name: "SAMPLE TRAINEE", adm_no: "EEPL6/0000/24M", course: "Electrical Engineering",
      cycle: "3", level, module: level === "6" ? "8" : "2",
      start_month: new Date().getMonth() + 1, start_year: new Date().getFullYear(),
    },
    await peekNextRef(), new Date(), await loadAssets(),
  );
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=sample.pdf" },
  });
}
