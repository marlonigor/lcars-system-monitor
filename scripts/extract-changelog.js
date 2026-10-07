import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Normalizes version tag by removing leading 'v'.
 * @param {string} tag
 * @returns {string}
 */
export function normalizeVersion(tag) {
    if (!tag || typeof tag !== 'string') {
        throw new TypeError(`Expected version string, received: ${typeof tag}`)
    }
    return tag.trim().replace(/^v/, '')
}

/**
 * Extracts release notes for a given version from changelog content.
 * @param {string} content
 * @param {string} versionTag
 * @returns {string}
 */
export function extractReleaseNotes(content, versionTag) {
    const version = normalizeVersion(versionTag)
    const headerRegex = new RegExp(`^##\\s+\\[?v?${version}\\]?(?:\\s+-\\s+.*)?$`, 'm')
    const match = headerRegex.exec(content)

    if (!match) {
        throw new Error(`Version ${versionTag} not found in changelog`)
    }

    const startIndex = match.index + match[0].length
    const remaining = content.slice(startIndex)
    const nextHeaderMatch = /^##\s+/m.exec(remaining)
    const sectionEnd = nextHeaderMatch ? nextHeaderMatch.index : remaining.length

    return remaining.slice(0, sectionEnd).trim()
}

/**
 * CLI entry point for extracting release notes.
 */
function runCli() {
    const targetTag = process.argv[2]
    if (!targetTag) {
        process.stderr.write('Usage: node scripts/extract-changelog.js <version-tag>\n')
        process.exit(1)
    }

    const changelogPath = resolve(process.cwd(), 'CHANGELOG.md')
    const content = readFileSync(changelogPath, 'utf-8')
    const notes = extractReleaseNotes(content, targetTag)
    process.stdout.write(notes + '\n')
}

if (process.argv[1]?.endsWith('extract-changelog.js')) {
    try {
        runCli()
    } catch (err) {
        process.stderr.write(`${err.message}\n`)
        process.exit(1)
    }
}
