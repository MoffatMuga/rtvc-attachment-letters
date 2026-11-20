import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Due list");
  ws.columns = [{ header: "Name", width: 32 }, { header: "Admission No", width: 20 }, { header: "Department", width: 28 }];
  ws.getRow(1).font = { bold: true };
  ws.addRow(["JANE AKINYI OTIENO", "EE/101/2024", "Electrical Engineering"]);
  const out = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(out as ArrayBuffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="due-list-template.xlsx"' },
  });
}
