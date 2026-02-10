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
        this._prevNetwork = null
    }

    /**
     * Returns top 20 processes by CPU and top 20 by memory, plus total count.
     * @returns {{ byCpu: Array, byMemory: Array, totalCount: number }}
     */
    async getProcesses() {
        try {
            const result = await si.processes()
            const list = result.list || []

            const byCpu = [...list]
                .sort((a, b) => b.cpu - a.cpu)
                .slice(0, 20)
                .map(this._mapProcess)

            const byMemory = [...list]
                .sort((a, b) => b.mem - a.mem)
                .slice(0, 20)
                .map(this._mapProcess)

            return {
                byCpu,
                byMemory,
                totalCount: list.length,
            }
        } catch (err) {
            log.error({ err }, 'Failed to collect process metrics')
            return null
        }
    }

    /**
     * Returns disk usage for mounted partitions. Cached for 5s.
     * @returns {Array<{ fs: string, mount: string, size: number, used: number, available: number, percentage: number }>}
     */
    async getDiskUsage() {
        const now = Date.now()

        if (this._diskCache.data && now - this._diskCache.timestamp < 5000) {
            log.debug('Disk cache hit')
            return this._diskCache.data
        }

        try {
            const disks = await si.fsSize()

            const mounted = disks
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

            this._diskCache = { data: mounted, timestamp: now }
            log.debug({ count: mounted.length }, 'Disk cache updated')
            return mounted
        } catch (err) {
            log.error({ err }, 'Failed to collect disk metrics')
            return null
        }
    }

    /**
     * Returns network bandwidth stats (bytes/second) using delta calculation.
     * First call returns null (needs baseline snapshot).
     * @returns {{ rxSec: number, txSec: number, interfaces: Array } | null}
     */
    async getNetworkStats() {
        try {
            const stats = await si.networkStats()
            const now = Date.now()

            // Aggregate all interfaces
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

            const prev = this._prevNetwork
            this._prevNetwork = { rx: totalRx, tx: totalTx, timestamp: now }

            if (!prev) {
                log.debug('First network read — no delta yet')
                return null
            }

            const elapsed = (now - prev.timestamp) / 1000
            if (elapsed <= 0) return null

            const rxSec = Math.round((totalRx - prev.rx) / elapsed)
            const txSec = Math.round((totalTx - prev.tx) / elapsed)

            return {
                rxSec: Math.max(rxSec, 0),
                txSec: Math.max(txSec, 0),
                interfaces: interfaces.filter((i) => i.rxSec > 0 || i.txSec > 0),
            }
        } catch (err) {
            log.error({ err }, 'Failed to collect network metrics')
            return null
        }
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
