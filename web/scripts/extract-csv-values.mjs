import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fields = ["gjendja", "kategoria", "komuna", "rajon", "periudha_detaj", "burimi"];
const sets = Object.fromEntries(fields.map((f) => [f, new Set()]));

function parseLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

for (const f of [
  "sites_arkeologjike.csv",
  "sites_arkitekturore.csv",
  "sites_luajtshme.csv",
]) {
  const text = fs.readFileSync(path.join(root, "data", f), "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const hdr = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    hdr.forEach((h, idx) => {
      if (sets[h] && cols[idx]) sets[h].add(cols[idx].trim());
    });
  }
}

for (const f of fields) {
  console.log(`--- ${f} (${sets[f].size})`);
  [...sets[f]].sort().forEach((v) => console.log(v));
}
