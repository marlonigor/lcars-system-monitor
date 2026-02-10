import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

// ── Config ───────────────────────────────────────────────────────────

const IGNORE_DIRS = ['node_modules', '.git', 'dist', '.agent', '.githooks'];
const IGNORE_FILES = [/\.test\.js$/, /\.spec\.js$/];

// ── Helpers ──────────────────────────────────────────────────────────

function readJSON(filePath) {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function gitLog(count = 20) {
    try {
        const raw = execSync(`git log --oneline -${count}`, {
            cwd: ROOT,
            encoding: 'utf-8',
        });
        return raw
            .trim()
            .split('\n')
            .filter(Boolean);
    } catch {
        return ['(no commits yet)'];
    }
}

function buildTree(dir, prefix = '') {
    const entries = readdirSync(dir).filter((entry) => {
        if (IGNORE_DIRS.includes(entry)) return false;
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isFile() && IGNORE_FILES.some((re) => re.test(entry))) return false;
        return true;
    });

    const lines = [];

    entries.forEach((entry, i) => {
        const fullPath = join(dir, entry);
        const isLast = i === entries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            lines.push(`${prefix}${connector}📁 ${entry}/`);
            lines.push(...buildTree(fullPath, prefix + childPrefix));
        } else {
            const icon = fileIcon(entry);
            lines.push(`${prefix}${connector}${icon} ${entry}`);
        }
    });

    return lines;
}

function fileIcon(filename) {
    const ext = filename.split('.').pop();
    const icons = {
        js: '📜',
        html: '🌐',
        css: '🎨',
        json: '📋',
        md: '📝',
    };
    return icons[ext] || '📄';
}

function formatDeps(deps) {
    if (!deps || Object.keys(deps).length === 0) return '_None_';
    return Object.entries(deps)
        .map(([name, version]) => `\`${name}\` ${version}`)
        .join(' · ');
}

function scriptDescription(key) {
    const descriptions = {
        dev: 'Start development server (client + backend)',
        'dev:server': 'Start backend with auto-reload',
        'dev:client': 'Start Vite dev server for the client',
        start: 'Run production server',
        lint: 'Run ESLint on source files',
        format: 'Format code with Prettier',
        test: 'Run unit tests',
        verify: 'Run smoke tests',
        readme: 'Regenerate README.md manually',
        setup: 'Install git hooks for auto-README',
    };
    return descriptions[key] || '—';
}

// ── Main ─────────────────────────────────────────────────────────────

function generate() {
    const pkg = readJSON(join(ROOT, 'package.json'));
    const commits = gitLog(20);
    const srcTree = buildTree(join(ROOT, 'src'));

    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

    const md = `# 🖖 ${pkg.name}

![version](https://img.shields.io/badge/version-${pkg.version}-blue)
![license](https://img.shields.io/badge/license-${pkg.license || 'MIT'}-green)
![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

> ${pkg.description || ''}

A Star Trek LCARS-inspired real-time dashboard that monitors your system's CPU, memory, disk, network, and processes — streamed live via Server-Sent Events.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/marlonigor/lcars-system-monitor.git
cd lcars-system-monitor

# Install dependencies
npm install

# Install git hooks (auto-updates README on each commit)
npm run setup

# Start development
npm run dev
\`\`\`

The client opens at **http://localhost:5173** and the API server runs on **http://localhost:3000**.

---

## 🖥️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Runtime** | Node.js (ESM) |
| **Server** | Express, Pino logger |
| **Real-time** | Server-Sent Events (SSE) |
| **Client** | Vanilla JS + Vite |
| **System Data** | systeminformation |

### Dependencies

${formatDeps(pkg.dependencies)}

### Dev Dependencies

${formatDeps(pkg.devDependencies)}

---

## 📁 Project Structure

\`\`\`
src/
${srcTree.join('\n')}
\`\`\`

> Test files (\`*.test.js\`) are co-located with their source files but omitted from the tree for clarity.

---

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
${Object.entries(pkg.scripts || {})
            .map(([key]) => `| \`npm run ${key}\` | ${scriptDescription(key)} |`)
            .join('\n')}

---

## 📋 Recent Changelog

| Hash | Message |
|------|---------|
${commits
            .map((c) => {
                const [hash, ...rest] = c.split(' ');
                return `| \`${hash}\` | ${rest.join(' ')} |`;
            })
            .join('\n')}

---

## 📄 License

This project is licensed under the **${pkg.license || 'MIT'}** license.

---

<sub>🤖 Auto-generated by <code>scripts/generate-readme.js</code> — last update: ${now} UTC</sub>
`;

    const readmePath = join(ROOT, 'README.md');
    writeFileSync(readmePath, md, 'utf-8');

    const relPath = relative(ROOT, readmePath);
    console.log(`✅ ${relPath} generated successfully (${md.length} bytes)`);
}

generate();
