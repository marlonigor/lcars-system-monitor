/**
 * Memory Renderer — usage bar + total/used/free breakdown.
 */

export class MemoryRenderer {
    constructor(elements = {}) {
        this._usedEl = elements.usedEl || (typeof document !== 'undefined' ? document.getElementById('memory-used') : null)
        this._totalEl = elements.totalEl || (typeof document !== 'undefined' ? document.getElementById('memory-total') : null)
        this._freeEl = elements.freeEl || (typeof document !== 'undefined' ? document.getElementById('memory-free') : null)
        this._barFill = elements.barFill || (typeof document !== 'undefined' ? document.getElementById('memory-bar-fill') : null)
        this._segmentsEl = elements.segmentsEl || (typeof document !== 'undefined' ? document.getElementById('memory-segments') : null)
        this._createElement = elements.createElement || (typeof document !== 'undefined' && document.createElement ? document.createElement.bind(document) : null)
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
        if (!this._segmentsEl || !this._createElement) return

        this._segmentsEl.innerHTML = ''
        const usedPct = data.percentage
        const freePct = 100 - usedPct

        const usedSeg = this._createElement('div')
        usedSeg.className = 'lcars-memory-segment'
        usedSeg.style.flex = usedPct
        usedSeg.style.background = 'var(--lcars-violet)'

        const freeSeg = this._createElement('div')
        freeSeg.className = 'lcars-memory-segment'
        freeSeg.style.flex = freePct
        freeSeg.style.background = 'rgba(204, 153, 204, 0.2)'

        this._segmentsEl.append(usedSeg, freeSeg)
    }
}
