// Makes the browser tab icon from your college logo.
//   node scripts/make-favicon.mjs
// Reads public/assets/logo.png, writes app/icon.png (and removes the old app/favicon.ico).
import sharp from "sharp";
import fs from "node:fs";

const src = "public/assets/logo.png";
if (!fs.existsSync(src)) { console.log(`\n❌ ${src} not found. Copy your logo there first.\n`); process.exit(1); }
await sharp(src)
  .resize(256, 256, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile("app/icon.png");
if (fs.existsSync("app/favicon.ico")) fs.rmSync("app/favicon.ico");
console.log("\n✅ Created app/icon.png from your logo (old favicon.ico removed).");
console.log("Restart the app, then hard-refresh the browser (Ctrl+Shift+R) to see the new tab icon.\n");
