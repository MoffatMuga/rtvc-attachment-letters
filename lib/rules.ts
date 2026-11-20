import rulesJson from "./rules.json";

export class ValidationError extends Error {}

type ModuleEntry = { units?: string[]; same_as?: [string, string] };
/**
 * A level either has attachment modules (cycle 3 style), or lists its units
 * directly with no modules at all (cycle 2 style).
 */
type Level = {
  /** Optional text in brackets after the course name for THIS level, e.g. "Masonry". Use "" for none. */
  option?: string;
  attachment_modules?: Record<string, ModuleEntry>;
  units?: string[];
};
type Cycles = Record<string, { levels: Record<string, Level> }>;
type Course = {
  /** Text shown in brackets after the course name on the letter, e.g. "power option". */
  option?: string;
  /** Use "cycles" directly for a course with no sections... */
  cycles?: Cycles;
  /** ...or "sections" (e.g. Food and Beverage, Cosmetology), each with its own cycles. */
  sections?: Record<string, { cycles: Cycles }>;
};
type Rules = { courses: Record<string, Course> };

const rules = rulesJson as unknown as Rules;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];

function resolve(course: string, section: string): Cycles {
  const c = rules.courses[course];
  if (!c) throw new ValidationError(`Unknown course: ${course}`);
  if (c.sections) {
    if (!section) throw new ValidationError(`Choose a section for ${course}.`);
    const s = c.sections[section];
    if (!s) throw new ValidationError(`Unknown section "${section}" for ${course}.`);
    return s.cycles;
  }
  return c.cycles ?? {};
}

/**
 * Course name as printed on the letter and shown to the ILO.
 * Bracket text, in order of priority: the level's own "option" (e.g. Building Technology level 4 -> Masonry),
 * else the section name (unless it is the same as the course name), else the course's "option".
 */
export function courseLabel(course: string, section = "", cycle = "", level = ""): string {
  const c = rules.courses[course];
  if (!c) return course;
  let tag: string | undefined;
  if (cycle && level) {
    try {
      const lv = resolve(course, section)[cycle]?.levels[level];
      if (lv && lv.option !== undefined) tag = lv.option.trim();
    } catch { /* unknown section: fall through */ }
  }
  if (tag === undefined) {
    if (c.sections) {
      if (section && section.trim().toLowerCase() !== course.trim().toLowerCase()) tag = section;
    } else if (c.option) {
      tag = c.option;
    }
  }
  return tag ? `${course} (${tag})` : course;
}

/**
 * Shape for the form dropdowns (no unit lists):
 * course -> section ("" when the course has no sections) -> cycle -> level -> modules
 */
export function publicRules() {
  const out: Record<string, Record<string, Record<string, Record<string, string[]>>>> = {};
  const flatten = (cycles: Cycles) => {
    const r: Record<string, Record<string, string[]>> = {};
    for (const [cycle, cy] of Object.entries(cycles)) {
      r[cycle] = {};
      for (const [level, lv] of Object.entries(cy.levels)) {
        // An empty list means "no modules for this level".
        r[cycle][level] = Object.keys(lv.attachment_modules ?? {});
      }
    }
    return r;
  };
  for (const [course, c] of Object.entries(rules.courses)) {
    out[course] = {};
    if (c.sections) {
      for (const [section, s] of Object.entries(c.sections)) out[course][section] = flatten(s.cycles);
    } else {
      out[course][""] = flatten(c.cycles ?? {});
    }
  }
  return out;
}

export function getUnits(
  course: string, cycle: string, level: string, module: string, section = "",
): string[] {
  const label = courseLabel(course, section);
  const cycles = resolve(course, section);
  const cy = cycles[cycle];
  if (!cy) throw new ValidationError(`Cycle ${cycle} is not set up for ${label}`);
  const lv = cy.levels[level];
  if (!lv) throw new ValidationError(`Level ${level} is not set up for ${label}`);
  if (!lv.attachment_modules) return lv.units ?? []; // no modules for this level
  const mods = lv.attachment_modules;
  if (!module) throw new ValidationError("Choose your module.");
  if (!(module in mods)) {
    const allowed = Object.keys(mods).map((m) => `module ${m}`).join(" or ");
    throw new ValidationError(
      `Level ${level} trainees in ${label} go for attachment at ${allowed}, not module ${module}.`,
    );
  }
  const entry = mods[module];
  if (entry.same_as) {
    return getUnits(course, cycle, entry.same_as[0], entry.same_as[1], section);
  }
  return entry.units ?? [];
}

export type CleanRequest = {
  name: string;
  adm_no: string;
  email: string;
  phone: string;
  course: string;
  section: string;
  cycle: string;
  level: string;
  module: string;
  start_month: number;
  start_year: number;
};

const ADM_RE = /^[A-Z]{2,6}\d?\/\d{1,5}\/\d{2}[A-Z]?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Accepts 0712345678, 712345678, 254712345678, +254 712 345 678 (also 01xx).
 * Returns +254XXXXXXXXX or null if it does not look like a Kenyan number. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  const m = digits.match(/^(?:\+?254|0)?([17]\d{8})$/);
  return m ? `+254${m[1]}` : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateRequest(body: any): CleanRequest {
  const name = String(body?.name ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  const adm_no = String(body?.adm_no ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (name.split(" ").length < 2 || name.length > 80) {
    throw new ValidationError("Enter your full name (at least two names).");
  }
  if (!ADM_RE.test(adm_no)) {
    throw new ValidationError(
      "Admission number looks wrong. Enter it in full, e.g. EEPL6/1592/24M.",
    );
  }
  if (!EMAIL_RE.test(email) || email.length > 120) {
    throw new ValidationError("Enter a valid email address.");
  }
  const phone = normalizePhone(String(body?.phone ?? ""));
  if (!phone) {
    throw new ValidationError("Enter a valid phone number, e.g. 0712 345 678.");
  }
  const start_month = Number(body?.start_month);
  const start_year = Number(body?.start_year);
  if (!Number.isInteger(start_month) || start_month < 1 || start_month > 12) {
    throw new ValidationError("Choose the attachment start month.");
  }
  const thisYear = new Date().getFullYear();
  if (!Number.isInteger(start_year) || start_year < thisYear - 1 || start_year > thisYear + 2) {
    throw new ValidationError("Choose a valid attachment start year.");
  }
  const course = String(body?.course ?? "");
  const section = String(body?.section ?? "");
  const cycle = String(body?.cycle ?? "");
  const level = String(body?.level ?? "");
  const module = String(body?.module ?? "");
  getUnits(course, cycle, level, module, section); // throws if invalid
  const hasModules = !!resolve(course, section)[cycle]?.levels[level]?.attachment_modules;
  return {
    name, adm_no, email, phone, course,
    section: rules.courses[course]?.sections ? section : "",
    cycle, level, module: hasModules ? module : "", start_month, start_year,
  };
}

/** Three-month period, e.g. ["January", "March 2027"]. */
export function periodText(startMonth: number, startYear: number): [string, string] {
  const endIndex = startMonth - 1 + 2;
  const endMonth = endIndex % 12;
  const endYear = startYear + Math.floor(endIndex / 12);
  const s = MONTHS[startMonth - 1];
  const e = MONTHS[endMonth];
  return endYear === startYear ? [s, `${e} ${endYear}`] : [`${s} ${startYear}`, `${e} ${endYear}`];
}
