/** Alias: node rebuild_te_gjitha.mjs → rindërton 3 CSV */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

spawnSync('node', ['build_three_csv.mjs'], {
  cwd: path.dirname(fileURLToPath(import.meta.url)),
  stdio: 'inherit',
});
