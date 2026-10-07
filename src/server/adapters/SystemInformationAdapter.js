import si from 'systeminformation'
import { SystemMetricsAdapter } from './SystemMetricsAdapter.js'
import logger from '../logger.js'

const log = logger.child({ layer: 'adapter', adapter: 'systeminformation' })

/**
 * Collects process and disk metrics using the `systeminformation` library.
 * Disk data is cached with a 5s TTL to avoid excessive I/O.
 */
export class SystemInformationAdapter extends SystemMetricsAdapter {
    constructor() {
        super()
        this._diskCache = { data: null, timestamp: 0 }
        this._processCache = { data: null, timestamp: 0 }
        this._networkCache = { data: null, timestamp: 0 }
        this._prevNetwork = null
    }

    /**
     * Returns top 20 processes by CPU and top 20 by memory, plus total count.
     * Cached for 5s to avoid heavy WMI/tasklist polling on Windows.
     * @returns {Promise<{ byCpu: Array, byMemory: Array, totalCount: number } | null>}
     */
    async getProcesses() {
        const now = Date.now()
        if (this._processCache.data && now - this._processCache.timestamp < 5000) {
            log.debug('Process cache hit')
            return this._processCache.data
        }

        try {
            const result = await si.processes()
            const list = result.list || []
            const data = this._formatProcessList(list)
            this._processCache = { data, timestamp: now }
            return data
        } catch (err) {
            log.error({ err }, 'Failed to collect process metrics')
            return this._processCache.data ?? null
        }
    }

    /**
     * Formats raw process list into top CPU and memory metrics.
     * @param {Array} list
     * @returns {{ byCpu: Array, byMemory: Array, totalCount: number }}
     */
    _formatProcessList(list) {
        const byCpu = [...list]
            .sort((a, b) => b.cpu - a.cpu)
            .slice(0, 20)
            .map(this._mapProcess)

        const byMemory = [...list]
            .sort((a, b) => b.mem - a.mem)
            .slice(0, 20)
            .map(this._mapProcess)

        return { byCpu, byMemory, totalCount: list.length }
    }

    /**
     * Returns disk usage for mounted partitions. Cached for 5s.
     * @returns {Promise<Array<{ fs: string, mount: string, size: number, used: number, available: number, percentage: number }> | null>}
     */
    async getDiskUsage() {
        const now = Date.now()

        if (this._diskCache.data && now - this._diskCache.timestamp < 5000) {
            log.debug('Disk cache hit')
            return this._diskCache.data
        }

        try {
            const disks = await si.fsSize()
            const mounted = this._mapMountedDisks(disks)
            this._diskCache = { data: mounted, timestamp: now }
            log.debug({ count: mounted.length }, 'Disk cache updated')
            return mounted
        } catch (err) {
            log.error({ err }, 'Failed to collect disk metrics')
            return this._diskCache.data ?? null
        }
    }

    /**
     * Maps raw disk list to formatted mounted disks.
     * @param {Array} disks
     * @returns {Array}
     */
    _mapMountedDisks(disks) {
        return disks
            .filter((d) => d.size > 0)
            .map((d) => ({
                fs: d.fs,
                mount: d.mount,
                type: d.type,
                size: d.size,
                used: d.used,
                available: d.available,
                percentage: Math.round(d.use * 100) / 100,
            }))
    }

    /**
     * Returns network bandwidth stats (bytes/second) using delta calculation.
     * First call returns null (needs baseline snapshot).
     * @returns {Promise<{ rxSec: number, txSec: number, interfaces: Array } | null>}
     */
    async getNetworkStats() {
        try {
            const stats = await si.networkStats()
            const now = Date.now()
            const { totalRx, totalTx, interfaces } = this._aggregateNetworkStats(stats)

            const prev = this._prevNetwork
            this._prevNetwork = { rx: totalRx, tx: totalTx, timestamp: now }

            if (!prev) {
                log.debug('First network read — no delta yet')
                return null
            }

            return this._computeNetworkDelta(totalRx, totalTx, now, prev, interfaces)
        } catch (err) {
            log.error({ err }, 'Failed to collect network metrics')
            return this._networkCache.data ?? null
        }
    }

    /**
     * Aggregates RX and TX across network interfaces.
     * @param {Array} stats
     * @returns {{ totalRx: number, totalTx: number, interfaces: Array }}
     */
    _aggregateNetworkStats(stats) {
        let totalRx = 0
        let totalTx = 0
        const interfaces = []

        for (const iface of stats) {
            totalRx += iface.rx_bytes || 0
            totalTx += iface.tx_bytes || 0
            interfaces.push({
                name: iface.iface,
                rxSec: Math.round(iface.rx_sec || 0),
                txSec: Math.round(iface.tx_sec || 0),
            })
        }

        return { totalRx, totalTx, interfaces }
    }

    /**
     * Computes network transfer rates from consecutive snapshots.
     * @param {number} totalRx
     * @param {number} totalTx
     * @param {number} now
     * @param {{ rx: number, tx: number, timestamp: number }} prev
     * @param {Array} interfaces
     * @returns {{ rxSec: number, txSec: number, interfaces: Array } | null}
     */
    _computeNetworkDelta(totalRx, totalTx, now, prev, interfaces) {
        const elapsed = (now - prev.timestamp) / 1000
        if (elapsed <= 0) return null

        const rxSec = Math.round((totalRx - prev.rx) / elapsed)
        const txSec = Math.round((totalTx - prev.tx) / elapsed)

        const result = {
            rxSec: Math.max(rxSec, 0),
            txSec: Math.max(txSec, 0),
            interfaces: interfaces.filter((i) => i.rxSec > 0 || i.txSec > 0),
        }

        this._networkCache = { data: result, timestamp: now }
        return result
    }

    /**
     * Maps a raw process object to a simplified shape.
     */
    _mapProcess(proc) {
        return {
            pid: proc.pid,
            name: proc.name,
            cpu: Math.round(proc.cpu * 100) / 100,
            memory: Math.round(proc.mem * 100) / 100,
            memRss: proc.memRss,
        }
    }
}
