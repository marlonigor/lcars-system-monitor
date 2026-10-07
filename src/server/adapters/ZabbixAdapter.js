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
