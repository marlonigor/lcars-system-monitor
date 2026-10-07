import { withTimeout } from '../adapters/withTimeout.js'
import logger from '../logger.js'

const log = logger.child({ layer: 'repository' })

/**
 * Orchestrates metric collection from multiple adapters.
 * Applies timeout, fallback to last known values, and per-metric status.
 */
export class MetricsRepository {
    /**
     * @param {import('../adapters/NodeNativeAdapter.js').NodeNativeAdapter} nodeAdapter
     * @param {import('../adapters/SystemInformationAdapter.js').SystemInformationAdapter} siAdapter
     * @param {import('../adapters/ZabbixAdapter.js').ZabbixAdapter} [alertAdapter]
     */
    constructor(nodeAdapter, siAdapter, alertAdapter = null) {
        this.nodeAdapter = nodeAdapter
        this.siAdapter = siAdapter
        this.alertAdapter = alertAdapter
        this._lastKnown = {
            cpu: null,
            memory: null,
            disk: null,
            processes: null,
            network: null,
            systemInfo: null,
            alerts: [],
        }
    }

    /**
     * Collects all system metrics with timeout protection and status tracking.
     * Always returns a result — never throws.
     */
    async getSystemMetrics() {
        const collectors = {
            cpu: () => this.nodeAdapter?.getCpuUsage?.(),
            memory: () => this.nodeAdapter?.getMemoryUsage?.(),
            disk: () => this.siAdapter?.getDiskUsage?.(),
            processes: () => this.siAdapter?.getProcesses?.(),
            network: () => this.siAdapter?.getNetworkStats?.(),
            systemInfo: () => this.nodeAdapter?.getSystemInfo?.(),
            alerts: () =>
                this.alertAdapter?.getActiveProblems
                    ? this.alertAdapter.getActiveProblems()
                    : Promise.resolve([]),
        }

        const keys = Object.keys(collectors)
        const results = await Promise.allSettled(
            keys.map((key) =>
                withTimeout(
                    Promise.resolve().then(() => collectors[key]()),
                    1000,
                ),
            ),
        )

        const metrics = {}

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            const result = results[i]

            if (result.status === 'fulfilled') {
                if (result.value !== null && result.value !== undefined) {
                    metrics[key] = { status: 'ok', data: result.value }
                    this._lastKnown[key] = result.value
                } else {
                    // Adapter returned null (e.g. first CPU read, or os.cpus() empty)
                    metrics[key] = {
                        status: 'unavailable',
                        data: this._lastKnown[key] ?? null,
                        error: `${key} returned null`,
                    }
                    log.warn({ key }, 'Metric returned null, using last known value')
                }
            } else {
                // Rejected — timeout or exception
                const isTimeout = result.reason?.message?.includes('Timeout')
                metrics[key] = {
                    status: isTimeout ? 'degraded' : 'unavailable',
                    data: this._lastKnown[key] ?? null,
                    error: result.reason?.message || 'Unknown error',
                }
                log.error({ key, error: result.reason?.message }, 'Metric collection failed')
            }
        }

        return metrics
    }
}
