/**
 * System Info Renderer — displays hostname, platform, uptime in the top bar.
 * Only updates on first data or when uptime changes.
 */

export class SystemInfoRenderer {
    constructor(elements = {}) {
        this._hostnameEl = elements.hostnameEl || (typeof document !== 'undefined' ? document.getElementById('sysinfo-hostname') : null)
        this._platformEl = elements.platformEl || (typeof document !== 'undefined' ? document.getElementById('sysinfo-platform') : null)
        this._uptimeEl = elements.uptimeEl || (typeof document !== 'undefined' ? document.getElementById('sysinfo-uptime') : null)
        this._initialized = false
    }

    render(metrics) {
        const info = metrics.systemInfo

        if (!info || info.status === 'unavailable' || !info.data) {
            return // Keep showing previous values or initial '---'
        }

        const data = info.data

        // Hostname and platform only need to be set once
        if (!this._initialized) {
            this._hostnameEl.textContent = data.hostname.toUpperCase()
            this._platformEl.textContent = `${data.platform.toUpperCase()} ${data.arch}`
            this._initialized = true
        }

        // Uptime changes every minute
        this._uptimeEl.textContent = `UP ${data.uptimeFormatted}`
    }
}
