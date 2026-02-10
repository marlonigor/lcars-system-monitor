/**
 * LCARS System Monitor — Frontend Entry Point
 *
 * Initializes SSE client and all renderers.
 * Each renderer is wrapped in try/catch — a crash in one doesn't affect others.
 */

import { SSEClient } from './sseClient.js'
import { CpuRenderer } from './renderers/cpuRenderer.js'
import { MemoryRenderer } from './renderers/memoryRenderer.js'
import { DiskRenderer } from './renderers/diskRenderer.js'
import { ProcessRenderer } from './renderers/processRenderer.js'
import { NetworkRenderer } from './renderers/networkRenderer.js'
import { SystemInfoRenderer } from './renderers/systemInfoRenderer.js'
import { StatusRenderer } from './renderers/statusRenderer.js'

// --- Initialize Renderers ---

const statusRenderer = new StatusRenderer()
const cpuRenderer = new CpuRenderer()
const memoryRenderer = new MemoryRenderer()
const diskRenderer = new DiskRenderer()
const processRenderer = new ProcessRenderer()
const networkRenderer = new NetworkRenderer()
const systemInfoRenderer = new SystemInfoRenderer()

const renderers = [
    { name: 'cpu', instance: cpuRenderer },
    { name: 'memory', instance: memoryRenderer },
    { name: 'disk', instance: diskRenderer },
    { name: 'processes', instance: processRenderer },
    { name: 'network', instance: networkRenderer },
    { name: 'systemInfo', instance: systemInfoRenderer },
]

// --- Render with Error Boundaries ---

function renderAll(metrics) {
    // Status renderer is critical — render first, no boundary
    statusRenderer.renderMetricsStatus(metrics)

    // Each metric renderer is isolated
    for (const { name, instance } of renderers) {
        try {
            instance.render(metrics)
        } catch (err) {
            console.error(`[${name}] Renderer crashed:`, err)
            const panel = document.getElementById(`${name}-panel`)
            if (panel) {
                const body = panel.querySelector('.lcars-panel-body')
                if (body) {
                    body.innerHTML = '<div class="lcars-sensor-offline">SENSOR OFFLINE</div>'
                }
            }
        }
    }
}

// --- SSE Client ---

const sseClient = new SSEClient()

sseClient.connect(
    // onData
    (metrics) => renderAll(metrics),

    // onStatus
    (status) => statusRenderer.renderConnectionStatus(status),
)

// --- Reconnect Button ---

statusRenderer.reconnectButton.addEventListener('click', () => {
    sseClient.reconnect()
})
