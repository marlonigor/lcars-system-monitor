/**
 * Disk Renderer — cards per partition with usage bars.
 * Color changes: normal → warning (>80%) → critical (>90%)
 */

export class DiskRenderer {
    constructor() {
        this._listEl = document.getElementById('disk-list')
    }

    render(metrics) {
        const disk = metrics.disk

        if (disk.status === 'unavailable' && !disk.data) {
            this._listEl.innerHTML =
                '<div class="lcars-sensor-offline">STORAGE OFFLINE</div>'
            return
        }

        const disks = disk.data
        if (!disks || disks.length === 0) {
            this._listEl.innerHTML =
                '<div class="lcars-sensor-offline">NO VOLUMES DETECTED</div>'
            return
        }

        const toGB = (bytes) => (bytes / 1_073_741_824).toFixed(1)

        this._listEl.innerHTML = disks
            .map((d) => {
                const pct = d.percentage
                const fillClass =
                    pct >= 90 ? 'critical' : pct >= 80 ? 'warning' : ''

                return `
          <div class="lcars-disk-card">
            <span class="lcars-disk-mount">${this._escapeHtml(d.mount)}</span>
            <div class="lcars-disk-bar">
              <div class="lcars-disk-fill ${fillClass}" style="width: ${pct}%"></div>
            </div>
            <span class="lcars-disk-info">${toGB(d.used)} / ${toGB(d.size)} GB</span>
          </div>
        `
            })
            .join('')
    }

    _escapeHtml(str) {
        const div = document.createElement('div')
        div.textContent = str
        return div.innerHTML
    }
}
