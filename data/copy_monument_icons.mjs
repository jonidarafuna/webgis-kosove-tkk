/**
 * Kopjon ikona nga PC-ja jote në web/images/icons/
 *
 * node data/copy_monument_icons.mjs "C:\path\to\foto.png" arkeologjike
 * node data/copy_monument_icons.mjs "C:\path\to\foto.svg" arkitekturore
 * node data/copy_monument_icons.mjs "C:\path\to\foto.png" luajtshme
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "web", "images", "icons");

const VALID = ["arkeologjike", "arkitekturore", "luajtshme"];

const src = process.argv[2];
const typeKey = process.argv[3];

if (!src || !typeKey) {
  console.log("Përdorimi:");
  console.log('  node data/copy_monument_icons.mjs "C:\\path\\to\\ikona.png" arkeologjike');
  console.log("Llojet:", VALID.join(", "));
  process.exit(1);
}

if (!VALID.includes(typeKey)) {
  console.error("Lloji i panjohur:", typeKey);
  process.exit(1);
}

if (!fs.existsSync(src)) {
  console.error("Skedari nuk ekziston:", src);
  process.exit(1);
}

const ext = path.extname(src).toLowerCase() || ".png";
const dest = path.join(OUT_DIR, typeKey + ext);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.copyFileSync(src, dest);

console.log("Kopjuar:", dest);
console.log("");
console.log("Nëse shtesa nuk është .png, përditëso web/js/config.js:");
console.log('  MONUMENT_ICONS.' + typeKey + '.file = "' + typeKey + ext + '"');
