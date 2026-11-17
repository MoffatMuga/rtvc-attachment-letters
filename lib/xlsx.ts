import ExcelJS from "exceljs";
import { ensureDb, db, toRow } from "./db";
import { courseLabel, periodText } from "./rules";

/** Builds the attachment log from all approved letters. */
export async function buildLog(): Promise<Buffer> {
  await ensureDb();
  const res = await db().execute(
    "SELECT * FROM requests WHERE status = 'approved' ORDER BY id ASC",
  );
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Attachment letters");
  ws.columns = [
    { header: "No.", key: "no", width: 6 },
    { header: "Ref", key: "ref", width: 18 },
    { header: "Date issued", key: "date", width: 14 },
    { header: "Name", key: "name", width: 30 },
    { header: "Admission No", key: "adm", width: 18 },
    { header: "Course", key: "course", width: 34 },
    { header: "Level", key: "level", width: 8 },
    { header: "Module", key: "module", width: 9 },
    { header: "Attachment period", key: "period", width: 28 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Email", key: "email", width: 30 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  res.rows.forEach((raw, i) => {
    const r = toRow(raw as unknown as Record<string, unknown>);
    const [s, e] = periodText(r.start_month, r.start_year);
    ws.addRow({
      no: i + 1,
      ref: r.ref,
      date: (r.decided_at ?? "").slice(0, 10),
      name: r.name,
      adm: r.adm_no,
      course: courseLabel(r.course, r.section, r.cycle, r.level),
      level: Number(r.level),
      module: r.module ? Number(r.module) : "",
      period: `${s} to ${e}`,
      phone: r.phone,
      email: r.email,
    });
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
