/**
 * Plotëson kolonat KosovaRef01 brenda skedarëve ekzistues (jo skedar të ri _kosovaref01).
 * node convert_all_kosovaref01.mjs
 */
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const files = ['sites_arkeologjike.csv', 'sites_arkitekturore.csv', 'sites_luajtshme.csv'];

for (const f of files) {
  const src = join(__dirname, f);
  if (!src) continue;
  console.log(`\n→ ${f} (në vend)`);
  const r = spawnSync('node', [join(__dirname, 'convert_kosovaref01.js'), src, src], {
    stdio: 'inherit',
    cwd: __dirname,
  });
  if (r.status !== 0) process.exit(r.status);
}

console.log('\nGati — kolonat easting/northing në të njëjtin CSV.');
console.log('Ose: node build_three_csv.mjs');
