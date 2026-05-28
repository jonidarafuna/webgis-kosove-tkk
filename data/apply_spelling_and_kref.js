/** Normalizon drejtshkrimin dhe KosovaRef01 në 3 CSV. */
const { spawnSync } = require('child_process');
const path = require('path');
spawnSync('node', ['build_three_csv.mjs'], { cwd: __dirname, stdio: 'inherit' });
