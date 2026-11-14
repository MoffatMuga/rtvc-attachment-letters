import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildLog } from "@/lib/xlsx";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const buf = await buildLog();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Attachment letters log.xlsx"',
    },
  });
}
