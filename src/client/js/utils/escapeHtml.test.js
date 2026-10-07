import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml } from './escapeHtml.js'

describe('escapeHtml', () => {
    it('escapes characters with potential HTML injection', () => {
        const input = '<script>alert("xss") & test\'s</script>'
        const expected = '&lt;script&gt;alert(&quot;xss&quot;) &amp; test&#39;s&lt;/script&gt;'
        assert.equal(escapeHtml(input), expected)
    })

    it('returns empty string for null or undefined', () => {
        assert.equal(escapeHtml(null), '')
        assert.equal(escapeHtml(undefined), '')
    })

    it('handles numbers correctly', () => {
        assert.equal(escapeHtml(42), '42')
    })
})
