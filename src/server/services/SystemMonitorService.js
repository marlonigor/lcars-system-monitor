import logger from '../logger.js'

const log = logger.child({ layer: 'service' })

const HISTORY_SIZE = 60

/**
 * Business logic layer: enriches metrics with timestamp, global status,
 * and maintains a ring buffer of historical CPU/memory data.
 */
export class SystemMonitorService {
    /**
     * @param {import('../repositories/MetricsRepository.js').MetricsRepository} repository
     */
    constructor(repository) {
        this.repository = repository
        this._history = new Array(HISTORY_SIZE).fill(null)
        this._historyIndex = 0
    }

    /**
     * Collects current metrics, updates history, enriches with global status.
     * @returns {object} Full metrics payload ready for the client
     */
    async getCurrentMetrics() {
        const metrics = await this.repository.getSystemMetrics()
        const timestamp = Date.now()

        // Push to ring buffer (O(1))
        const cpuUsage = metrics.cpu.status === 'ok' ? metrics.cpu.data.usage : null
        const memPercentage = metrics.memory.status === 'ok' ? metrics.memory.data.percentage : null

        this._history[this._historyIndex % HISTORY_SIZE] = {
            cpu: cpuUsage,
            memory: memPercentage,
            timestamp,
        }
        this._historyIndex++

        // Compute global status
        const statuses = ['cpu', 'memory', 'disk', 'processes'].map((k) => metrics[k].status)
        const globalStatus = this._computeGlobalStatus(statuses)

        if (globalStatus !== 'ok') {
            log.warn({ globalStatus, statuses }, 'System status is not fully operational')
        }

        return {
            timestamp,
            status: globalStatus,
            cpu: metrics.cpu,
            memory: metrics.memory,
            disk: metrics.disk,
            processes: metrics.processes,
            history: this.getHistory(),
        }
    }

    /**
     * Returns history sorted chronologically, filtering out empty slots.
     * @returns {Array<{ cpu: number|null, memory: number|null, timestamp: number }>}
     */
    getHistory() {
        return this._history.filter(Boolean).sort((a, b) => a.timestamp - b.timestamp)
    }

    /**
     * Global status priority matrix:
     *   - All ok → 'ok'
     *   - All unavailable → 'critical'
     *   - Any degraded or unavailable (mixed) → 'degraded'
     */
    _computeGlobalStatus(statuses) {
        const allOk = statuses.every((s) => s === 'ok')
        if (allOk) return 'ok'

        const allUnavailable = statuses.every((s) => s === 'unavailable')
        if (allUnavailable) return 'critical'

        return 'degraded'
    }
}
