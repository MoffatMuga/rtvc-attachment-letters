import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ensureDb();
  const r = await db().execute(`SELECT t.*, a.name AS assessor_name, a.phone AS assessor_phone FROM trainees t
    LEFT JOIN assessors a ON a.id = t.assessor_id ORDER BY t.name`);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Placements");
  ws.columns = [
    ["Name", 30], ["Admission No", 18], ["Phone", 16], ["Email", 30], ["Assessor", 24], ["Assessor phone", 16],
    ["Firm", 30], ["Location", 22], ["Firm address", 30], ["Firm phone", 16], ["Department at firm", 22],
    ["Supervisor", 24], ["Supervisor title", 20], ["Supervisor phone", 16], ["Supervisor email", 28],
    ["Start date", 12], ["End date", 12],
  ].map(([header, width]) => ({ header: header as string, width: width as number }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const s = (v: unknown) => (v == null ? "" : String(v));
  for (const x of r.rows) {
    ws.addRow([
      x.name, x.adm_no, x.phone, x.email, x.assessor_name ?? "Not assigned", x.assessor_phone,
      x.firm_name, x.firm_location, x.firm_address, x.firm_phone, x.department_at_firm,
      x.supervisor_name, x.supervisor_title, x.supervisor_phone, x.supervisor_email, x.start_date, x.end_date,
    ].map(s));
  }
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Trainee placements.xlsx"',
    },
  });
}
