import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { CREST_PNG_B64, LOGO_PNG_B64 } from "./assets-data";
import { courseLabel, getUnits, periodText } from "./rules";

export type LetterInput = {
  name: string;
  adm_no: string;
  course: string;
  section?: string;
  level: string;
  module: string;
  cycle: string;
  start_month: number;
  start_year: number;
};

export type Placement = {
  stamp_width: number; // pt
  date_x: number; // % of stamp width (left edge of date text)
  date_y: number; // % of stamp height from top (text baseline)
  date_size: number; // pt
  sig_x: number; // % of stamp width (left edge)
  sig_y: number; // % of stamp height from top (top edge)
  sig_w: number; // % of stamp width
};

export const DEFAULT_PLACEMENT: Placement = {
  stamp_width: 176,
  date_x: 24,
  date_y: 90,
  date_size: 9,
  sig_x: 55,
  sig_y: 45,
  sig_w: 40,
};

export type LetterAssets = {
  stampPng?: Buffer | null;
  signaturePng?: Buffer | null;
  placement?: Partial<Placement>;
};

const W = 595.28;
const H = 841.89;
const F = 0.551; // sample-image px -> pt
const px = (v: number) => v * F;
const GREY = rgb(0.4, 0.4, 0.4);
const BLACK = rgb(0, 0, 0);
const BLUE = rgb(0.12, 0.23, 0.6);

function ddmmyyyy(d: Date, short = false) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${short ? yyyy.slice(2) : yyyy}`;
}

type Seg = { text: string; bold: boolean };

/** Draw a paragraph made of regular/bold segments, wrapped to `width`.
 * Returns the y position below the paragraph. */
function drawRich(
  page: PDFPage, regular: PDFFont, bold: PDFFont, segs: Seg[],
  x: number, yTop: number, width: number, size = 11.5, leading = 14.2,
) {
  // Split into words keeping bold flag.
  const words: { w: string; bold: boolean }[] = [];
  for (const s of segs) {
    for (const part of s.text.split(/(\s+)/)) {
      if (part === "") continue;
      words.push({ w: part, bold: s.bold });
    }
  }
  const lines: { w: string; bold: boolean }[][] = [[]];
  let lineW = 0;
  for (const word of words) {
    const font = word.bold ? bold : regular;
    const ww = font.widthOfTextAtSize(word.w, size);
    const isSpace = /^\s+$/.test(word.w);
    if (!isSpace && lineW + ww > width && lines[lines.length - 1].length > 0) {
      lines.push([]);
      lineW = 0;
    }
    if (isSpace && lines[lines.length - 1].length === 0) continue;
    lines[lines.length - 1].push(word);
    lineW += ww;
  }
  let y = yTop;
  for (const line of lines) {
    y -= leading;
    let cx = x;
    for (const word of line) {
      const font = word.bold ? bold : regular;
      page.drawText(word.w, { x: cx, y: y + 3.3, size, font, color: BLACK });
      cx += font.widthOfTextAtSize(word.w, size);
    }
  }
  return y;
}

export async function generateLetter(
  data: LetterInput, ref: string, when: Date, assets: LetterAssets = {},
): Promise<Uint8Array> {
  const pl: Placement = { ...DEFAULT_PLACEMENT, ...(assets.placement ?? {}) };
  const units = getUnits(data.course, data.cycle, data.level, data.module, data.section ?? "");

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Attachment letter - ${data.name}`);
  const page = pdf.addPage([W, H]);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const left = px(127);
  const textW = W - px(127) - left;
  const txt = (
    s: string, x: number, y: number, size: number, font: PDFFont, color = BLACK,
  ) => page.drawText(s, { x, y, size, font, color });
  const centered = (s: string, cx: number, y: number, size: number, font: PDFFont, color = GREY) =>
    txt(s, cx - font.widthOfTextAtSize(s, size) / 2, y, size, font, color);

  // Letterhead
  const crest = await pdf.embedPng(Buffer.from(CREST_PNG_B64, "base64"));
  const logo = await pdf.embedPng(Buffer.from(LOGO_PNG_B64, "base64"));
  page.drawImage(crest, { x: px(80), y: H - px(142), width: px(165), height: px(134) });
  page.drawImage(logo, { x: px(840), y: H - px(142), width: px(195), height: px(130) });
  const cx = W / 2;
  centered("RANGWE TECHNICAL & VOCATIONAL COLLEGE", cx, H - px(42), 12.5, reg);
  centered("P.O. BOX 396-40300, HOMABAY", cx, H - px(64), 10, reg);
  centered("Mobile: +254 (0)718 035 475", cx, H - px(86), 10, reg);
  const email = "rangwetechnical@gmail.com";
  const labelW = reg.widthOfTextAtSize("Email:", 10);
  const emailW = reg.widthOfTextAtSize(email, 10);
  const ex = cx - (labelW + emailW) / 2;
  txt("Email:", ex, H - px(108), 10, reg, GREY);
  const linkBlue = rgb(0.17, 0.31, 0.84);
  txt(email, ex + labelW, H - px(108), 10, reg, linkBlue);
  page.drawLine({
    start: { x: ex + labelW, y: H - px(108) - 1.5 },
    end: { x: ex + labelW + emailW, y: H - px(108) - 1.5 },
    thickness: 0.6, color: linkBlue,
  });
  centered("(INDUSTRIAL LIAISONS OFFICER)", cx, H - px(130), 10, ital);
  page.drawLine({
    start: { x: 0, y: H - px(163) }, end: { x: W, y: H - px(163) },
    thickness: 1.2, color: GREY,
  });

  // Refs and date
  let y = H - px(208);
  txt("Your Ref ………………………….", left, y, 11.5, reg);
  txt(`Date:${ddmmyyyy(when)}`, px(636), y, 11.5, reg);
  y -= px(49);
  txt(`Our Ref: ${ref}`, left, y, 11.5, reg);
  y -= px(60);
  txt("TO WHOM IT MAY CONCERN", left, y, 11.5, reg);
  y -= px(49);
  const subject = `RE: INDUSTRIAL ATTACHMENT FOR ${data.name} ADM NO: ${data.adm_no}`;
  txt(subject, left, y, 11.5, bold);
  page.drawLine({
    start: { x: left, y: y - 2 },
    end: { x: left + bold.widthOfTextAtSize(subject, 11.5), y: y - 2 },
    thickness: 0.8, color: BLACK,
  });

  y -= 8;
  const courseLine = `${courseLabel(data.course, data.section ?? "", data.cycle, data.level)} Level ${data.level}`;
  y = drawRich(page, reg, bold, [
    { text: "The above named is a trainee at ", bold: false },
    { text: "Rangwe Technical and Vocational College", bold: true },
    { text: ", undergoing a ", bold: false },
    { text: "TVET/CBET", bold: true },
    { text: " course in ", bold: false },
    { text: courseLine, bold: true },
    { text: ".", bold: false },
  ], left, y, textW) - 14;
  const [start, end] = periodText(data.start_month, data.start_year);
  y = drawRich(page, reg, bold, [
    { text: "To expose this trainee to practical skills, a ", bold: false },
    { text: "three months’", bold: true },
    { text: " industry training is necessary. I am therefore, writing to request you to offer the trainee an attachment opportunity in your firm from ", bold: false },
    { text: start, bold: true },
    { text: " to ", bold: false },
    { text: end, bold: true },
    { text: ".", bold: false },
  ], left, y, textW) - 14;
  if (units.length > 0) {
    y = drawRich(page, reg, bold, [
      { text: "The ", bold: false },
      { text: "areas", bold: true },
      { text: " of skills are:", bold: false },
    ], left, y, textW) - 8;

    for (const unit of units) {
      page.drawCircle({ x: left + 12, y: y - 4, size: 1.6, color: BLACK });
      txt(unit, left + 36, y - 8, 11.5, reg);
      y -= 14.4;
    }
    y -= 10;
  }
  y = drawRich(page, reg, bold, [
    { text: "During the attachment period, our trainees are insured in case of injury. I will be grateful if you kindly assist in this matter.", bold: false },
  ], left, y, textW) - 14;
  txt("Yours faithfully,", left, y - 8, 11.5, reg);
  y -= 22;

  // Stamp (+ optional signature). Placeholder is drawn if no scan uploaded.
  const stampX = left + 4;
  if (assets.stampPng) {
    const img = await pdf.embedPng(assets.stampPng);
    const sw = pl.stamp_width;
    const sh = (img.height / img.width) * sw;
    const sy = y - sh - 4;
    page.drawImage(img, { x: stampX, y: sy, width: sw, height: sh });
    if (assets.signaturePng) {
      const sig = await pdf.embedPng(assets.signaturePng);
      const gw = (pl.sig_w / 100) * sw;
      const gh = (sig.height / sig.width) * gw;
      page.drawImage(sig, {
        x: stampX + (pl.sig_x / 100) * sw,
        y: sy + sh - (pl.sig_y / 100) * sh - gh,
        width: gw, height: gh,
      });
    }
    txt(
      ddmmyyyy(when, true),
      stampX + (pl.date_x / 100) * sw,
      sy + sh - (pl.date_y / 100) * sh,
      pl.date_size, bold, BLUE,
    );
    y = sy - 6;
  } else {
    const sw = 176;
    const sh = 66;
    const sy = y - sh - 4;
    page.drawRectangle({ x: stampX, y: sy, width: sw, height: sh, borderColor: BLUE, borderWidth: 1.2 });
    const c2 = (s: string, yy: number, size: number, f: PDFFont) =>
      txt(s, stampX + sw / 2 - f.widthOfTextAtSize(s, size) / 2, yy, size, f, BLUE);
    c2("RANGWE T.V.C", sy + sh - 18, 15, bold);
    c2("P.O. BOX 396 - 40300, HOMABAY", sy + sh - 28, 6.2, reg);
    c2("LIAISONS OFFICER", sy + sh - 40, 8.5, reg);
    txt("Date:", stampX + 6, sy + 8, 7, reg, BLUE);
    txt(ddmmyyyy(when, true), stampX + 28, sy + 8, 9, bold, BLUE);
    txt("Sign:.................", stampX + 85, sy + 8, 7, reg, BLUE);
    y = sy - 6;
  }

  y -= 24;
  txt("MOFFAT MUGA ODEMBO", left, y, 11.5, reg);
  y -= 28;
  const title = "INDUSTRIAL LIAISON OFFICER";
  txt(title, left, y, 11.5, bold);
  page.drawLine({
    start: { x: left, y: y - 2 },
    end: { x: left + bold.widthOfTextAtSize(title, 11.5), y: y - 2 },
    thickness: 0.8, color: BLACK,
  });
  y -= 14;
  txt("For PRINCIPAL", left, y, 11.5, bold);
  if (y < 30) throw new Error("Letter content overflows the page");
  return pdf.save();
}
