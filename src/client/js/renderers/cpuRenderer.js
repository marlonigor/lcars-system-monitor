/**
 * CPU Renderer — LCARS bar + historical canvas chart.
 *
 * Canvas: fixed logical size 600×150, DPI-aware with devicePixelRatio scaling.
 * Dirty flag: only redraws if data changed.
 */

const LCARS_SKY = '#99ccff'
const LCARS_SKY_DIM = 'rgba(153, 204, 255, 0.15)'
const LCARS_BG = '#0a0a1a'
const LCARS_GRID = 'rgba(153, 204, 255, 0.08)'

export class CpuRenderer {
    constructor() {
        this._usageEl = document.getElementById('cpu-usage')
        this._barFill = document.getElementById('cpu-bar-fill')
        this._canvas = document.getElementById('cpu-history-canvas')
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
        const cpu = metrics.cpu

        if (cpu.status === 'unavailable' && !cpu.data) {
            this._usageEl.textContent = 'N/A'
            this._usageEl.classList.add('lcars-unavailable')
            this._barFill.style.width = '0%'
            return
        }

        this._usageEl.classList.remove('lcars-unavailable')

        const usage = cpu.data?.usage
        if (usage !== null && usage !== undefined) {
            this._usageEl.textContent = usage.toFixed(1)
            this._barFill.style.width = `${usage}%`
        }

        // Draw history chart (dirty flag: only if history changed)
        const history = metrics.history || []
        if (history.length === this._lastHistoryLength && history.length > 0) {
            return // No new data
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

        const cpuPoints = history.map((h) => h.cpu).filter((v) => v !== null)
        if (cpuPoints.length < 2) return

        const step = w / (60 - 1) // Always 60 slots
        const offset = 60 - cpuPoints.length

        // Fill area
        ctx.beginPath()
        ctx.moveTo((offset) * step, h)
        for (let i = 0; i < cpuPoints.length; i++) {
            const x = (offset + i) * step
            const y = h - (cpuPoints[i] / 100) * h
            if (i === 0) {
                ctx.lineTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }
        }
        ctx.lineTo((offset + cpuPoints.length - 1) * step, h)
        ctx.closePath()
        ctx.fillStyle = LCARS_SKY_DIM
        ctx.fill()

        // Line
        ctx.beginPath()
        for (let i = 0; i < cpuPoints.length; i++) {
            const x = (offset + i) * step
            const y = h - (cpuPoints[i] / 100) * h
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = LCARS_SKY
        ctx.lineWidth = 2
        ctx.stroke()
    }
}
