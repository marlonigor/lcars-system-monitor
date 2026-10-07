import { withTimeout } from '../adapters/withTimeout.js'
import logger from '../logger.js'

const log = logger.child({ layer: 'repository' })

const DEFAULT_TIMEOUT_MS = parseInt(process.env.METRICS_TIMEOUT_MS || '3000', 10)

/**
 * Orchestrates metric collection from multiple adapters.
 * Applies timeout, fallback to last known values, and per-metric status.
 */
export class MetricsRepository {
    /**
     * @param {import('../adapters/NodeNativeAdapter.js').NodeNativeAdapter} nodeAdapter
     * @param {import('../adapters/SystemInformationAdapter.js').SystemInformationAdapter} siAdapter
     * @param {import('../adapters/ZabbixAdapter.js').ZabbixAdapter} [alertAdapter]
     * @param {number} [timeoutMs]
     */
    constructor(nodeAdapter, siAdapter, alertAdapter = null, timeoutMs = DEFAULT_TIMEOUT_MS) {
        this.nodeAdapter = nodeAdapter
        this.siAdapter = siAdapter
        this.alertAdapter = alertAdapter
        this.timeoutMs = timeoutMs
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
     * @returns {Promise<object>}
     */
    async getSystemMetrics() {
        const collectors = this._getCollectors()
        const keys = Object.keys(collectors)
        const promises = keys.map((key) =>
            withTimeout(
                Promise.resolve().then(() => collectors[key]()),
                this.timeoutMs,
            ),
        )

        const results = await Promise.allSettled(promises)
        const metrics = {}

        for (let i = 0; i < keys.length; i++) {
            metrics[keys[i]] = this._evaluateResult(keys[i], results[i])
        }

        return metrics
    }

    /**
     * Builds mapping of collectors to invoke.
     * @returns {Record<string, () => Promise<any>>}
     */
    _getCollectors() {
        return {
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
    }

    /**
     * Evaluates settled promise result into status object.
     * @param {string} key
     * @param {PromiseSettledResult<any>} result
     * @returns {{ status: string, data: any, error?: string }}
     */
    _evaluateResult(key, result) {
        if (result.status === 'fulfilled') {
            return this._processFulfilledResult(key, result.value)
        }
        return this._processRejectedResult(key, result.reason)
    }

    /**
     * Processes fulfilled metric result.
     * @param {string} key
     * @param {any} value
     * @returns {{ status: string, data: any, error?: string }}
     */
    _processFulfilledResult(key, value) {
        if (value !== null && value !== undefined) {
            this._lastKnown[key] = value
            return { status: 'ok', data: value }
        }

        log.warn({ key }, 'Metric returned null, using last known value')
        return {
            status: 'unavailable',
            data: this._lastKnown[key] ?? null,
            error: `${key} returned null`,
        }
    }

    /**
     * Processes rejected metric result (timeout or error).
     * @param {string} key
     * @param {Error} reason
     * @returns {{ status: string, data: any, error: string }}
     */
    _processRejectedResult(key, reason) {
        const isTimeout = reason?.message?.includes('Timeout')
        log.error({ key, error: reason?.message }, 'Metric collection failed')

        return {
            status: isTimeout ? 'degraded' : 'unavailable',
            data: this._lastKnown[key] ?? null,
            error: reason?.message || 'Unknown error',
        }
    }
}
