/**
 * Network Renderer — RX/TX bandwidth with auto-scaling units
 * and a dual-line canvas chart showing historical bandwidth.
 *
 * Chart: teal line for RX (download), orange line for TX (upload).
 * Y-axis auto-scales to peak bandwidth in the visible window.
 */

const LCARS_TEAL = '#66cccc'
const LCARS_TEAL_DIM = 'rgba(102, 204, 204, 0.12)'
const LCARS_ORANGE = '#ff9900'
const LCARS_ORANGE_DIM = 'rgba(255, 153, 0, 0.10)'
const LCARS_BG = '#0a0a1a'
const LCARS_GRID = 'rgba(102, 204, 204, 0.08)'
const HISTORY_SLOTS = 60

export class NetworkRenderer {
    constructor() {
        this._rxEl = document.getElementById('network-rx')
        this._txEl = document.getElementById('network-tx')
        this._rxUnitEl = document.getElementById('network-rx-unit')
        this._txUnitEl = document.getElementById('network-tx-unit')
        this._interfacesEl = document.getElementById('network-interfaces')
        this._peakLabel = document.getElementById('network-peak-label')
        this._canvas = document.getElementById('network-history-canvas')
        this._ctx = this._canvas.getContext('2d')
        this._lastHistoryLength = 0
        this._setupCanvas()
    }

    _setupCanvas() {
        const dpr = window.devicePixelRatio || 1
        const rect = this._canvas.getBoundingClientRect()
        const width = rect.width || 600
        const height = rect.height || 150

        this._canvas.width = width * dpr
        this._canvas.height = height * dpr
        this._ctx.scale(dpr, dpr)
        this._logicalWidth = width
        this._logicalHeight = height
    }

    render(metrics) {
        const net = metrics.network

        if (net.status === 'unavailable' && !net.data) {
            this._rxEl.textContent = 'N/A'
            this._txEl.textContent = 'N/A'
            this._rxEl.classList.add('lcars-unavailable')
            this._txEl.classList.add('lcars-unavailable')
            this._interfacesEl.innerHTML = ''
            return
        }

        this._rxEl.classList.remove('lcars-unavailable')
        this._txEl.classList.remove('lcars-unavailable')

        const data = net.data
        if (data) {
            const { value: rxVal, unit: rxUnit } = this._formatBandwidth(data.rxSec)
            const { value: txVal, unit: txUnit } = this._formatBandwidth(data.txSec)

            this._rxEl.textContent = rxVal
            this._rxUnitEl.textContent = rxUnit
            this._txEl.textContent = txVal
            this._txUnitEl.textContent = txUnit

            // Interface breakdown
            if (data.interfaces && data.interfaces.length > 0) {
                this._interfacesEl.innerHTML = data.interfaces
                    .slice(0, 5)
                    .map((iface) => {
                        const rx = this._formatBandwidth(iface.rxSec)
                        const tx = this._formatBandwidth(iface.txSec)
                        return `
              <div class="lcars-network-iface">
                <span class="lcars-network-iface-name">${this._escapeHtml(iface.name)}</span>
                <span class="lcars-network-iface-rate">↓ ${rx.value} ${rx.unit}</span>
                <span class="lcars-network-iface-rate">↑ ${tx.value} ${tx.unit}</span>
              </div>
            `
                    })
                    .join('')
            } else {
                this._interfacesEl.innerHTML = ''
            }
        }

        // Draw chart (dirty flag)
        const history = metrics.history || []
        if (history.length === this._lastHistoryLength && history.length > 0) {
            return
        }
        this._lastHistoryLength = history.length
        this._drawHistory(history)
    }

    _drawHistory(history) {
        const ctx = this._ctx
        const w = this._logicalWidth
        const h = this._logicalHeight

        // Clear
        ctx.fillStyle = LCARS_BG
        ctx.fillRect(0, 0, w, h)

        // Grid lines
        ctx.strokeStyle = LCARS_GRID
        ctx.lineWidth = 0.5
        for (let i = 0; i <= 4; i++) {
            const y = (h / 4) * i
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(w, y)
            ctx.stroke()
        }

        if (history.length < 2) return

        // Extract rx/tx points (filter out nulls)
        const rxPoints = history.map((h) => h.networkRx).filter((v) => v !== null && v !== undefined)
        const txPoints = history.map((h) => h.networkTx).filter((v) => v !== null && v !== undefined)

        if (rxPoints.length < 2 && txPoints.length < 2) return

        // Auto-scale Y axis: find peak value across both rx and tx
        const allValues = [...rxPoints, ...txPoints]
        const peak = Math.max(...allValues, 1024) // minimum 1 KB/s scale
        const yMax = this._niceYMax(peak)

        // Update peak label
        const { value: peakVal, unit: peakUnit } = this._formatBandwidth(yMax)
        this._peakLabel.textContent = `PEAK: ${peakVal} ${peakUnit}`

        const step = w / (HISTORY_SLOTS - 1)

        // Draw RX fill + line (teal)
        if (rxPoints.length >= 2) {
            this._drawLine(ctx, rxPoints, step, w, h, yMax, LCARS_TEAL, LCARS_TEAL_DIM)
        }

        // Draw TX fill + line (orange)
        if (txPoints.length >= 2) {
            this._drawLine(ctx, txPoints, step, w, h, yMax, LCARS_ORANGE, LCARS_ORANGE_DIM)
        }
    }

    _drawLine(ctx, points, step, w, h, yMax, lineColor, fillColor) {
        const offset = HISTORY_SLOTS - points.length

        // Fill area
        ctx.beginPath()
        ctx.moveTo(offset * step, h)
        for (let i = 0; i < points.length; i++) {
            const x = (offset + i) * step
            const y = h - (points[i] / yMax) * h
            ctx.lineTo(x, y)
        }
        ctx.lineTo((offset + points.length - 1) * step, h)
        ctx.closePath()
        ctx.fillStyle = fillColor
        ctx.fill()

        // Line
        ctx.beginPath()
        for (let i = 0; i < points.length; i++) {
            const x = (offset + i) * step
            const y = h - (points[i] / yMax) * h
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 2
        ctx.stroke()
    }

    /**
     * Rounds up to a "nice" Y axis max (powers of 2 × 1024).
     * e.g., 1500 → 2048, 50000 → 65536, 2M → 2097152
     */
    _niceYMax(value) {
        if (value <= 1024) return 1024
        const exp = Math.ceil(Math.log2(value))
        return Math.pow(2, exp)
    }

    /**
     * Auto-scales bytes/sec to KB/s, MB/s, or GB/s.
     */
    _formatBandwidth(bytesPerSec) {
        if (bytesPerSec == null || bytesPerSec < 0) {
            return { value: '0', unit: 'B/s' }
        }
        if (bytesPerSec < 1024) {
            return { value: bytesPerSec.toFixed(0), unit: 'B/s' }
        } else if (bytesPerSec < 1_048_576) {
            return { value: (bytesPerSec / 1024).toFixed(1), unit: 'KB/s' }
        } else if (bytesPerSec < 1_073_741_824) {
            return { value: (bytesPerSec / 1_048_576).toFixed(2), unit: 'MB/s' }
        } else {
            return { value: (bytesPerSec / 1_073_741_824).toFixed(2), unit: 'GB/s' }
        }
    }

    _escapeHtml(str) {
        const div = document.createElement('div')
        div.textContent = str
        return div.innerHTML
    }
}
