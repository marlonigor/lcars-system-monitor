/**
 * System Info Renderer — displays hostname, platform, uptime in the top bar.
 * Only updates on first data or when uptime changes.
 */

export class SystemInfoRenderer {
    constructor() {
        this._hostnameEl = document.getElementById('sysinfo-hostname')
        this._platformEl = document.getElementById('sysinfo-platform')
        this._uptimeEl = document.getElementById('sysinfo-uptime')
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
