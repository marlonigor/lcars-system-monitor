import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeVersion, extractReleaseNotes } from './extract-changelog.js'

describe('extract-changelog', () => {
    describe('normalizeVersion', () => {
        it('strips leading v from semver tag', () => {
            assert.equal(normalizeVersion('v1.2.3'), '1.2.3')
        })

        it('retains semver without v prefix', () => {
            assert.equal(normalizeVersion('1.2.3'), '1.2.3')
        })

        it('throws for non-string input', () => {
            assert.throws(() => normalizeVersion(null), /Expected version string/)
        })
    })

    describe('extractReleaseNotes', () => {
        const sampleChangelog = `
# Changelog

## [0.2.0] - 2026-10-10
### Added
- New audio synthesizer

## [0.1.0] - 2026-10-07
### Added
- Initial LCARS monitor release
- Real-time SSE streaming

### Fixed
- Metric collection timeouts
`

        it('extracts notes for targeted version with v prefix', () => {
            const notes = extractReleaseNotes(sampleChangelog, 'v0.1.0')
            assert(notes.includes('Initial LCARS monitor release'))
            assert(notes.includes('Metric collection timeouts'))
            assert(!notes.includes('New audio synthesizer'))
        })

        it('extracts notes for latest version before next header', () => {
            const notes = extractReleaseNotes(sampleChangelog, '0.2.0')
            assert(notes.includes('New audio synthesizer'))
            assert(!notes.includes('Initial LCARS monitor release'))
        })

        it('throws descriptive error when version is missing', () => {
            assert.throws(() => extractReleaseNotes(sampleChangelog, 'v9.9.9'), /Version v9.9.9 not found/)
        })
    })
})
