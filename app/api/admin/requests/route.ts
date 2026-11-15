import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listRequests, peekNextRef } from "@/lib/db";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  return Response.json({
    requests: await listRequests(status),
    nextRef: await peekNextRef(),
  });
}
