/**
 * Process Renderer — LCARS table with CPU/Memory sort toggle.
 * Re-renders fully each update (20 rows = trivial DOM work).
 */

import { escapeHtml } from '../utils/escapeHtml.js'

export class ProcessRenderer {
    constructor(elements = {}) {
        this._listEl = elements.listEl || (typeof document !== 'undefined' ? document.getElementById('process-list') : null)
        this._totalCountEl = elements.totalCountEl || (typeof document !== 'undefined' ? document.getElementById('process-total-count') : null)
        this._toggleEl = elements.toggleEl || (typeof document !== 'undefined' ? document.getElementById('process-sort-toggle') : null)
        this._sortBy = 'cpu' // 'cpu' or 'memory'

        if (this._toggleEl) {
            this._setupToggle()
        }
    }

    _setupToggle() {
        this._toggleEl.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-sort]') : null
            if (!btn) return

            this._sortBy = btn.dataset.sort

            // Update active state
            if (this._toggleEl.querySelectorAll) {
                this._toggleEl.querySelectorAll('.lcars-button').forEach((b) => {
                    b.classList.toggle('active', b.dataset.sort === this._sortBy)
                })
            }

            // Re-render with current data
            if (this._lastData) {
                this._renderList(this._lastData)
            }
        })
    }

    render(metrics) {
        const proc = metrics.processes

        if (proc.status === 'unavailable' && !proc.data) {
            this._listEl.innerHTML =
                '<div class="lcars-sensor-offline">PROCESS SCANNER OFFLINE</div>'
            this._totalCountEl.textContent = 'N/A'
            return
        }

        const data = proc.data
        if (!data) return

        this._lastData = data
        this._totalCountEl.textContent = data.totalCount || '--'
        this._renderList(data)
    }

    _renderList(data) {
        const list = this._sortBy === 'cpu' ? data.byCpu : data.byMemory
        if (!list || list.length === 0) {
            this._listEl.innerHTML = ''
            return
        }

        this._listEl.innerHTML = list
            .map(
                (p) => `
          <div class="lcars-process-row">
            <span class="proc-pid">${p.pid}</span>
            <span class="proc-name">${escapeHtml(p.name)}</span>
            <span class="proc-cpu">${p.cpu.toFixed(1)}</span>
            <span class="proc-mem">${p.memory.toFixed(1)}</span>
          </div>
        `,
            )
            .join('')
    }
}
