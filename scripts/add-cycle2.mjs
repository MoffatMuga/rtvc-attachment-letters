// Adds "cycle 2" to every course (and every section) in lib/rules.json.
//
// For each course it copies the list of LEVELS from cycle 3, with no modules
// and an empty unit list. Fill in the real units afterwards (see the README).
// A level with an empty list prints its letter WITHOUT the "areas of skills" list.
//
// Run from the project folder:
//   node scripts/add-cycle2.mjs              (change lib/rules.json, keeps a backup)
//   node scripts/add-cycle2.mjs --dry-run    (only show what would change)
//   node scripts/add-cycle2.mjs --levels 4,5 (use these levels instead of cycle 3's)
import fs from "node:fs";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const li = args.indexOf("--levels");
const forced = li >= 0 ? String(args[li + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : null;
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--levels") ?? "lib/rules.json";

let data;
try {
  data = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.log(`\n❌ Could not read ${file}: ${e.message}\n   Fix the file (usually a missing or extra comma) and run again.\n`);
  process.exit(1);
}
if (!data.courses) {
  console.log(`\n❌ ${file} has no "courses" section.\n`);
  process.exit(1);
}

const report = [];
function addTo(label, cycles) {
  if (!cycles) return;
  if (cycles["2"]) return report.push(`  ${label}: already has cycle 2 (left as it is)`);
  const source = cycles["3"] ?? Object.values(cycles)[0];
  const levels = forced ?? Object.keys(source?.levels ?? {});
  if (levels.length === 0) return report.push(`  ${label}: no levels found to copy, skipped`);
  cycles["2"] = { levels: Object.fromEntries(levels.map((l) => [l, { units: [] }])) };
  report.push(`  ${label}: added cycle 2 with levels ${levels.join(", ")} (units still empty)`);
}

for (const [course, c] of Object.entries(data.courses)) {
  if (c.sections) for (const [section, s] of Object.entries(c.sections)) addTo(`${course} - ${section}`, s.cycles);
  else addTo(course, c.cycles);
}

console.log("\n" + (report.join("\n") || "  nothing to do") + "\n");
if (dry) { console.log("Dry run: nothing was changed.\n"); process.exit(0); }
if (!report.some((r) => r.includes("added"))) process.exit(0);

const backup = file.replace(/\.json$/, "") + `.backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
fs.copyFileSync(file, backup);
fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(`✅ Saved ${file}. Your old file is kept as ${backup}.`);
console.log("Next: restart the app (Ctrl+C, then npm run dev), then fill in each level's units for cycle 2.\n");
