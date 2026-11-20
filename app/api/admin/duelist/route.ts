import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { admKey } from "@/lib/duelist";

const cell = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as { text?: unknown; richText?: { text: string }[]; result?: unknown };
    if (o.richText) return o.richText.map((x) => x.text).join("").trim();
    if (o.text != null) return String(o.text).trim();
    if (o.result != null) return String(o.result).trim();
  }
  return String(v).trim();
};

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ensureDb();
  const r = await db().execute("SELECT adm_no, name, department FROM due_list ORDER BY name LIMIT 2000");
  return Response.json({ count: r.rows.length, rows: r.rows.map((x) => ({ adm_no: String(x.adm_no), name: String(x.name), department: String(x.department) })) });
}

/** Replace the whole list with an uploaded .xlsx or .csv (columns: Name, Admission No, Department). */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > 3 * 1024 * 1024) return Response.json({ error: "File is too large." }, { status: 400 });

  const wb = new ExcelJS.Workbook();
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    if (file.name.toLowerCase().endsWith(".csv")) {
      const { Readable } = await import("node:stream");
      await wb.csv.read(Readable.from([buf]));
    } else {
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
    }
  } catch {
    return Response.json({ error: "Could not read that file. Use .xlsx or .csv." }, { status: 400 });
  }
  const ws = wb.worksheets[0];
  if (!ws) return Response.json({ error: "The file has no data." }, { status: 400 });

  // find columns from the header row by name
  const head: Record<string, number> = {};
  ws.getRow(1).eachCell((c, i) => {
    const h = cell(c.value).toLowerCase();
    if (/adm/.test(h) && head.adm == null) head.adm = i;
    else if (/name/.test(h) && head.name == null) head.name = i;
    else if (/(dep|section|course)/.test(h) && head.dep == null) head.dep = i;
  });
  if (head.adm == null) return Response.json({ error: "No admission number column found. The first row must have headings: Name, Admission No, Department." }, { status: 400 });

  const rows = new Map<string, { adm: string; name: string; dep: string }>();
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const adm = cell(row.getCell(head.adm).value).toUpperCase();
    const key = admKey(adm);
    if (!key) return;
    rows.set(key, { adm, name: head.name ? cell(row.getCell(head.name).value) : "", dep: head.dep ? cell(row.getCell(head.dep).value) : "" });
  });
  if (rows.size === 0) return Response.json({ error: "No admission numbers found in the file." }, { status: 400 });
  if (rows.size > 5000) return Response.json({ error: "Too many rows (limit 5000)." }, { status: 400 });

  await ensureDb();
  await db().batch([
    "DELETE FROM due_list",
    ...[...rows].map(([k, v]) => ({ sql: "INSERT INTO due_list (adm_key, adm_no, name, department) VALUES (?,?,?,?)", args: [k, v.adm, v.name, v.dep] })),
  ], "write");
  return Response.json({ ok: true, count: rows.size });
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ensureDb();
  await db().execute("DELETE FROM due_list");
  return Response.json({ ok: true });
}
