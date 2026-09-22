const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

const targetDirs = ['server'];
let totalChecked = 0;
let hasError = false;

function scan(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      scan(fullPath);
    } else if (entry.endsWith('.js') || entry.endsWith('.cjs') || entry.endsWith('.mjs')) {
      try {
        execFileSync(process.execPath, ['--check', fullPath], { stdio: 'pipe' });
        totalChecked++;
      } catch (err) {
        console.error(`❌ Syntax error in ${fullPath}:\n${err.stderr ? err.stderr.toString() : err.message}`);
        hasError = true;
      }
    }
  }
}

console.log('🔍 Running JavaScript syntax verification across backend files...');
for (const dir of targetDirs) {
  scan(dir);
}

if (hasError) {
  console.error(`\n❌ Syntax verification failed!`);
  process.exit(1);
} else {
  console.log(`✅ Syntax verification passed! Checked ${totalChecked} files with 0 errors.\n`);
  process.exit(0);
}
