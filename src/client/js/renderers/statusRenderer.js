/**
 * Status Renderer — connection status indicator + global system status + timestamp.
 */

export class StatusRenderer {
    constructor() {
        this._dotEl = document.querySelector('.lcars-status-dot')
        this._textEl = document.querySelector('.lcars-status-text')
        this._systemStatusEl = document.getElementById('system-status-text')
        this._timeEl = document.getElementById('last-update-time')
        this._reconnectBanner = null
        this._createReconnectBanner()
    }

    _createReconnectBanner() {
        this._reconnectBanner = document.createElement('div')
        this._reconnectBanner.className = 'lcars-reconnect-banner'
        this._reconnectBanner.textContent = '▶ RECONNECT'
        document.body.appendChild(this._reconnectBanner)
    }

    /**
     * Updates the connection status indicator.
     * @param {'connected'|'reconnecting'|'disconnected'} status
     */
    renderConnectionStatus(status) {
        // Reset classes
        this._dotEl.className = 'lcars-status-dot'

        switch (status) {
            case 'connected':
                this._dotEl.classList.add('connected')
                this._textEl.textContent = 'ONLINE'
                this._reconnectBanner.classList.remove('visible')
                break
            case 'reconnecting':
                this._dotEl.classList.add('reconnecting')
                this._textEl.textContent = 'RECONNECTING'
                this._reconnectBanner.classList.remove('visible')
                break
            case 'disconnected':
                this._dotEl.classList.add('disconnected')
                this._textEl.textContent = 'DISCONNECTED'
                this._reconnectBanner.classList.add('visible')
                break
        }
    }

    /**
     * Updates global system status and last update time.
     */
    renderMetricsStatus(metrics) {
        const status = metrics.status || 'ok'

        switch (status) {
            case 'ok':
                this._systemStatusEl.textContent = 'ALL SYSTEMS NOMINAL'
                this._systemStatusEl.style.color = 'var(--lcars-teal)'
                break
            case 'degraded':
                this._systemStatusEl.textContent = 'DEGRADED MODE'
                this._systemStatusEl.style.color = 'var(--lcars-orange)'
                break
            case 'critical':
                this._systemStatusEl.textContent = 'CRITICAL — SENSORS OFFLINE'
                this._systemStatusEl.style.color = 'var(--lcars-mars)'
                break
        }

        // Update timestamp
        if (metrics.timestamp) {
            const date = new Date(metrics.timestamp)
            this._timeEl.textContent = date.toLocaleTimeString('en-US', { hour12: false })
        }
    }

    /** Returns the reconnect banner element (for click binding) */
    get reconnectButton() {
        return this._reconnectBanner
    }
}
