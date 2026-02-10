import os from 'node:os'
import { SystemMetricsAdapter } from './SystemMetricsAdapter.js'
import logger from '../logger.js'

const log = logger.child({ layer: 'adapter', adapter: 'node-native' })

/**
 * Collects CPU and memory metrics using Node.js native `os` module.
 * CPU usage is calculated via tick deltas between consecutive calls.
 */
export class NodeNativeAdapter extends SystemMetricsAdapter {
    constructor() {
        super()
        this._prevCpuTicks = null
    }

    /**
     * Calculates CPU usage percentage from tick deltas.
     *
     * Formula:
     *   1. Read os.cpus() → sum all cores: busy = user+nice+sys+irq, idle = idle
     *   2. totalTicks = busy + idle
     *   3. If previous snapshot exists:
     *        deltaTotal = totalTicks - prev.total
     *        deltaIdle  = idleTicks - prev.idle
     *        usage%     = ((deltaTotal - deltaIdle) / deltaTotal) * 100
     *   4. Save current ticks as previous
     *   5. First call returns null (no delta available)
     *
     * @returns {{ usage: number } | null}
     */
    async getCpuUsage() {
        const cpus = os.cpus()

        if (!cpus || cpus.length === 0) {
            log.error('os.cpus() returned empty array')
            return null
        }

        let idleTicks = 0
        let totalTicks = 0

        for (const cpu of cpus) {
            const { user, nice, sys, idle, irq } = cpu.times
            idleTicks += idle
            totalTicks += user + nice + sys + idle + irq
        }

        const prev = this._prevCpuTicks
        this._prevCpuTicks = { idle: idleTicks, total: totalTicks }

        if (!prev) {
            log.debug('First CPU read — no delta yet')
            return null
        }

        const deltaTotal = totalTicks - prev.total
        const deltaIdle = idleTicks - prev.idle

        if (deltaTotal === 0) {
            return { usage: 0 }
        }

        const usage = ((deltaTotal - deltaIdle) / deltaTotal) * 100

        return {
            usage: Math.round(usage * 100) / 100,
        }
    }

    /**
     * Returns system memory usage from os.totalmem() and os.freemem().
     * @returns {{ total: number, used: number, free: number, percentage: number }}
     */
    async getMemoryUsage() {
        const total = os.totalmem()
        const free = os.freemem()
        const used = total - free
        const percentage = (used / total) * 100

        return {
            total,
            used,
            free,
            percentage: Math.round(percentage * 100) / 100,
        }
    }
}
