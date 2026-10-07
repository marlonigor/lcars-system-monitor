/**
 * Escapes unsafe HTML characters to prevent XSS vulnerabilities.
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) {
        return ''
    }
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}
