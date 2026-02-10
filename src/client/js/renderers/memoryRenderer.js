/**
 * Memory Renderer — usage bar + total/used/free breakdown.
 */

export class MemoryRenderer {
    constructor() {
        this._usedEl = document.getElementById('memory-used')
        this._totalEl = document.getElementById('memory-total')
        this._freeEl = document.getElementById('memory-free')
        this._barFill = document.getElementById('memory-bar-fill')
        this._segmentsEl = document.getElementById('memory-segments')
    }

    render(metrics) {
        const mem = metrics.memory

        if (mem.status === 'unavailable' && !mem.data) {
            this._usedEl.textContent = 'N/A'
            this._usedEl.classList.add('lcars-unavailable')
            this._totalEl.textContent = '--'
            this._freeEl.textContent = '--'
            this._barFill.style.width = '0%'
            return
        }

        this._usedEl.classList.remove('lcars-unavailable')

        const data = mem.data
        if (!data) return

        const toGB = (bytes) => (bytes / 1_073_741_824).toFixed(1)

        this._usedEl.textContent = toGB(data.used)
        this._totalEl.textContent = toGB(data.total)
        this._freeEl.textContent = toGB(data.free)
        this._barFill.style.width = `${data.percentage}%`

        // Memory segments visualization
        this._segmentsEl.innerHTML = ''
        const usedPct = data.percentage
        const freePct = 100 - usedPct

        const usedSeg = document.createElement('div')
        usedSeg.className = 'lcars-memory-segment'
        usedSeg.style.flex = usedPct
        usedSeg.style.background = 'var(--lcars-violet)'

        const freeSeg = document.createElement('div')
        freeSeg.className = 'lcars-memory-segment'
        freeSeg.style.flex = freePct
        freeSeg.style.background = 'rgba(204, 153, 204, 0.2)'

        this._segmentsEl.append(usedSeg, freeSeg)
    }
}
