---
name: update-readme
description: Auto-generate README.md from project metadata on each commit
---

# Update README Skill

Automatically generates and updates `README.md` based on the project's current state: `package.json`, source tree, and git history.

## How It Works

1. **Script**: `scripts/generate-readme.js` introspects the project and writes `README.md`
2. **Git Hook**: `.githooks/post-commit` runs the script after every commit and amends the commit to include the updated README
3. **Anti-recursion**: The environment variable `SKIP_README_HOOK=1` prevents infinite loops during the amend

## Sections Generated

| Section | Source |
|---|---|
| Title + Version Badge | `package.json` name, version |
| Description | `package.json` description |
| Tech Stack | `package.json` dependencies |
| Project Structure | Recursive scan of `src/` |
| Available Scripts | `package.json` scripts |
| Recent Changelog | `git log --oneline -20` |
| License | `package.json` license |

## Setup

```bash
# Install the git hook (required once per clone)
npm run setup

# Manual generation (without commit)
npm run readme
```

## Files

- `scripts/generate-readme.js` — README generator script
- `scripts/setup-hooks.js` — Git hook installer
- `.githooks/post-commit` — Git hook that triggers the generator

## Notes

- The hook stores the post-commit script in `.githooks/` (tracked by git) and `setup-hooks.js` copies it to `.git/hooks/` (untracked).
- If you need to skip the hook for a specific commit, run: `SKIP_README_HOOK=1 git commit -m "msg"`
- On Windows PowerShell: `$env:SKIP_README_HOOK=1; git commit -m "msg"`
