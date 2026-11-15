import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { normalizePhone } from "@/lib/rules";
import { toAssessor } from "@/lib/trainees";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ensureDb();
  const r = await db().execute(`SELECT a.*, (SELECT COUNT(*) FROM trainees t WHERE t.assessor_id = a.id) AS load
    FROM assessors a ORDER BY a.name`);
  return Response.json({
    assessors: r.rows.map((x) => ({ ...toAssessor(x as unknown as Record<string, unknown>), load: Number(x.load) })),
  });
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ensureDb();
  const b = await req.json().catch(() => ({}));
  const name = String(b?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const email = String(b?.email ?? "").trim().toLowerCase().slice(0, 120);
  const dept = String(b?.department ?? "").trim().slice(0, 80);
  let phone = String(b?.phone ?? "").trim();
  if (name.length < 2) return Response.json({ error: "Enter the assessor's name." }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Email is not valid." }, { status: 400 });
  if (phone) {
    const n = normalizePhone(phone);
    if (!n) return Response.json({ error: "Phone is not valid." }, { status: 400 });
    phone = n;
  }
  await db().execute({
    sql: "INSERT INTO assessors (name, email, phone, department) VALUES (?,?,?,?)",
    args: [name, email, phone, dept],
  });
  return Response.json({ ok: true });
}
