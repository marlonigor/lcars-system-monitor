/**
 * Status Renderer — connection status indicator + global system status + timestamp.
 * Supports Red Alert and Yellow Alert modes driven by Zabbix incidents.
 */

export class StatusRenderer {
    constructor(elements = {}) {
        this._dotEl = elements.dotEl || (typeof document !== 'undefined' ? document.querySelector('.lcars-status-dot') : null)
        this._textEl = elements.textEl || (typeof document !== 'undefined' ? document.querySelector('.lcars-status-text') : null)
        this._systemStatusEl = elements.systemStatusEl || (typeof document !== 'undefined' ? document.getElementById('system-status-text') : null)
        this._timeEl = elements.timeEl || (typeof document !== 'undefined' ? document.getElementById('last-update-time') : null)
        this._appRoot = elements.appRoot || (typeof document !== 'undefined' ? document.querySelector('.lcars-app') : null)
        this._incidentBanner = elements.incidentBanner || (typeof document !== 'undefined' ? document.getElementById('incident-banner') : null)
        this._reconnectBanner = elements.reconnectBanner || null
        if (!this._reconnectBanner && typeof document !== 'undefined' && document.createElement) {
            this._createReconnectBanner()
        }
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
     * Updates global system status, alert theme, incident banner and timestamp.
     * @param {object} metrics
     */
    renderMetricsStatus(metrics) {
        const alertLevel = metrics.alertLevel || 'nominal'
        const status = metrics.status || 'ok'
        const topAlert = Array.isArray(metrics.alerts) && metrics.alerts[0] ? metrics.alerts[0] : null

        this._updateAlertTheme(alertLevel, topAlert)
        this._updateStatusText(status, alertLevel, topAlert)
        this._updateTimestamp(metrics.timestamp)
    }

    _updateAlertTheme(alertLevel, topAlert) {
        if (this._appRoot?.classList) {
            this._appRoot.classList.toggle('alert-red', alertLevel === 'red')
            this._appRoot.classList.toggle('alert-yellow', alertLevel === 'yellow')
        }

        if (!this._incidentBanner) return

        if (alertLevel !== 'nominal' && topAlert) {
            this._incidentBanner.classList.add('visible')
            this._incidentBanner.classList.toggle('alert-red', alertLevel === 'red')
            this._incidentBanner.classList.toggle('alert-yellow', alertLevel === 'yellow')
            this._incidentBanner.textContent = `ALERT: ${topAlert.name.toUpperCase()} [${topAlert.severityLabel.toUpperCase()}]`
        } else {
            this._incidentBanner.classList.remove('visible', 'alert-red', 'alert-yellow')
            this._incidentBanner.textContent = ''
        }
    }

    _updateStatusText(status, alertLevel, topAlert) {
        if (!this._systemStatusEl) return

        if (alertLevel === 'red') {
            this._systemStatusEl.textContent = topAlert
                ? `RED ALERT — ${topAlert.name.toUpperCase()}`
                : 'CONDITION RED — RED ALERT'
            this._systemStatusEl.style.color = 'var(--lcars-mars)'
            return
        }

        if (alertLevel === 'yellow') {
            this._systemStatusEl.textContent = topAlert
                ? `YELLOW ALERT — ${topAlert.name.toUpperCase()}`
                : 'CONDITION YELLOW'
            this._systemStatusEl.style.color = 'var(--lcars-gold)'
            return
        }

        this._renderNominalStatusText(status)
    }

    _renderNominalStatusText(status) {
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
    }

    _updateTimestamp(timestamp) {
        if (!timestamp || !this._timeEl) return
        const date = new Date(timestamp)
        this._timeEl.textContent = date.toLocaleTimeString('en-US', { hour12: false })
    }

    /** Returns the reconnect banner element (for click binding) */
    get reconnectButton() {
        return this._reconnectBanner
    }
}
