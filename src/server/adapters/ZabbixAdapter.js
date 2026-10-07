import { SystemMetricsAdapter } from './SystemMetricsAdapter.js'
import { withTimeout } from './withTimeout.js'
import logger from '../logger.js'

const log = logger.child({ layer: 'adapter', adapter: 'zabbix' })

const SEVERITY_LABELS = {
    0: 'Not classified',
    1: 'Information',
    2: 'Warning',
    3: 'Average',
    4: 'High',
    5: 'Disaster',
}

/**
 * Adapter to collect metrics and active problems from Zabbix JSON-RPC 2.0 API.
 */
export class ZabbixAdapter extends SystemMetricsAdapter {
    /**
     * @param {object} config
     * @param {string} config.apiUrl
     * @param {string} config.apiToken
     * @param {string|number} config.hostId
     * @param {number} [config.timeoutMs=3000]
     * @param {Function} [config.fetchFn=globalThis.fetch]
     */
    constructor(config) {
        super()
        this._apiUrl = config.apiUrl
        this._apiToken = config.apiToken
        this._hostId = String(config.hostId)
        this._timeoutMs = config.timeoutMs || 3000
        this._fetchFn = config.fetchFn || globalThis.fetch
    }

    /**
     * Collects CPU utilization percentage from Zabbix item system.cpu.util.
     * @returns {Promise<{ usage: number } | null>}
     */
    async getCpuUsage() {
        return withTimeout(this._fetchCpu(), this._timeoutMs, 'zabbix.cpu')
    }

    /**
     * Collects memory usage metrics from Zabbix items (vm.memory.size).
     * @returns {Promise<{ total: number, used: number, free: number, percentage: number } | null>}
     */
    async getMemoryUsage() {
        return withTimeout(this._fetchMemory(), this._timeoutMs, 'zabbix.memory')
    }

    /**
     * Collects storage partitions and usage from Zabbix items (vfs.fs.size).
     * @returns {Promise<Array<{ fs: string, mount: string, type: string, size: number, used: number, available: number, percentage: number }> | null>}
     */
    async getDiskUsage() {
        return withTimeout(this._fetchDisk(), this._timeoutMs, 'zabbix.disk')
    }

    /**
     * Collects active incidents from Zabbix problem.get.
     * @returns {Promise<Array<{ id: string, name: string, severity: number, severityLabel: string, timestamp: number }>>}
     */
    async getActiveProblems() {
        return withTimeout(this._fetchProblems(), this._timeoutMs, 'zabbix.problems')
    }

    async _fetchCpu() {
        const items = await this._callApi('item.get', {
            hostids: this._hostId,
            search: { key_: 'system.cpu.util' },
            output: ['lastvalue'],
        })

        const rawValue = items?.[0]?.lastvalue
        if (rawValue === undefined || rawValue === null) {
            return null
        }

        const usage = parseFloat(rawValue)
        return isNaN(usage) ? null : { usage: Math.round(usage * 100) / 100 }
    }

    async _fetchMemory() {
        const items = await this._callApi('item.get', {
            hostids: this._hostId,
            search: { key_: 'vm.memory.' },
            output: ['key_', 'lastvalue'],
        })

        if (!Array.isArray(items) || items.length === 0) {
            return null
        }

        return this._parseMemoryItems(items)
    }

    _parseMemoryItems(items) {
        let total = 0
        let available = 0
        let utilPct = null

        for (const item of items) {
            const val = parseFloat(item.lastvalue)
            if (isNaN(val)) continue
            if (item.key_.includes('vm.memory.size[total]')) total = val
            if (item.key_.includes('vm.memory.size[available]')) available = val
            if (item.key_.includes('vm.memory.util')) utilPct = val
        }

        if (total <= 0) return null

        const used = Math.max(total - available, 0)
        const percentage =
            utilPct !== null
                ? Math.round(utilPct * 100) / 100
                : Math.round((used / total) * 10000) / 100

        return {
            total: Math.round(total),
            used: Math.round(used),
            free: Math.round(available),
            percentage,
        }
    }

    async _fetchDisk() {
        const items = await this._callApi('item.get', {
            hostids: this._hostId,
            search: { key_: 'vfs.fs.size' },
            output: ['key_', 'lastvalue'],
        })

        if (!Array.isArray(items) || items.length === 0) {
            return null
        }

        return this._parseDiskItems(items)
    }

    _parseDiskItems(items) {
        const mountMap = this._groupDiskItems(items)
        if (mountMap.size === 0) return null

        const disks = []
        for (const [mount, data] of mountMap.entries()) {
            if (data.total <= 0) continue
            const used = data.used || Math.max(data.total - data.free, 0)
            const available = data.free || Math.max(data.total - used, 0)
            const percentage =
                data.pused !== null
                    ? Math.round(data.pused * 100) / 100
                    : Math.round((used / data.total) * 10000) / 100

            disks.push({
                fs: mount,
                mount,
                type: 'vfs',
                size: Math.round(data.total),
                used: Math.round(used),
                available: Math.round(available),
                percentage,
            })
        }

        return disks.length > 0 ? disks : null
    }

    _groupDiskItems(items) {
        const map = new Map()
        for (const item of items) {
            const match = item.key_.match(/^vfs\.fs\.size\[([^,\]]+),?([^\]]*)\]$/)
            if (!match) continue
            const mount = match[1]
            const mode = match[2] || 'total'
            const val = parseFloat(item.lastvalue)
            if (isNaN(val)) continue

            if (!map.has(mount)) {
                map.set(mount, { total: 0, used: 0, free: 0, pused: null })
            }
            const entry = map.get(mount)
            if (mode === 'total') entry.total = val
            else if (mode === 'used') entry.used = val
            else if (mode === 'free') entry.free = val
            else if (mode === 'pused') entry.pused = val
        }
        return map
    }

    async _fetchProblems() {
        const problems = await this._callApi('problem.get', {
            hostids: this._hostId,
            sortfield: ['eventid'],
            sortorder: 'DESC',
            output: ['eventid', 'name', 'severity', 'clock'],
        })

        if (!Array.isArray(problems)) {
            return []
        }

        return problems.map((p) => ({
            id: String(p.eventid),
            name: p.name,
            severity: parseInt(p.severity, 10) || 0,
            severityLabel: SEVERITY_LABELS[p.severity] || 'Unknown',
            timestamp: parseInt(p.clock, 10) * 1000,
        }))
    }

    async _callApi(method, params) {
        const endpoint = `${this._apiUrl.replace(/\/$/, '')}/api_jsonrpc.php`
        const payload = {
            jsonrpc: '2.0',
            method,
            params,
            id: Date.now(),
        }

        try {
            const res = await this._fetchFn(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json-rpc',
                    'Authorization': `Bearer ${this._apiToken}`,
                },
                body: JSON.stringify(payload),
            })

            const body = await res.json()
            if (body.error) {
                log.error({ error: body.error, method }, 'Zabbix API returned JSON-RPC error')
                return null
            }

            return body.result
        } catch (err) {
            log.error({ err, method }, 'Network failure calling Zabbix API')
            return null
        }
    }
}
