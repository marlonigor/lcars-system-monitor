import { copyFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const source = join(ROOT, '.githooks', 'post-commit');
const hooksDir = join(ROOT, '.git', 'hooks');
const dest = join(hooksDir, 'post-commit');

if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
}

copyFileSync(source, dest);

try {
    chmodSync(dest, 0o755);
} catch {
    // chmod may fail on Windows, but git for Windows handles it
}

console.log('✅ Git hook installed: .git/hooks/post-commit');
console.log('   README.md will be auto-updated on each commit.');
