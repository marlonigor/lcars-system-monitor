import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ZabbixAdapter } from './ZabbixAdapter.js'

function createFakeFetch(handler) {
    return async (url, options) => {
        const body = JSON.parse(options.body)
        const responseData = await handler(url, body)
        return {
            json: async () => responseData,
        }
    }
}

describe('ZabbixAdapter', () => {
    describe('getCpuUsage', () => {
        it('returns numeric CPU usage from system.cpu.util item', async () => {
            const fetchFn = createFakeFetch(async (_url, body) => {
                assert.equal(body.method, 'item.get')
                return {
                    result: [{ lastvalue: '42.75' }],
                }
            })

            const adapter = new ZabbixAdapter({
                apiUrl: 'http://zabbix.local',
                apiToken: 'fake-token',
                hostId: '10084',
                fetchFn,
            })

            const cpu = await adapter.getCpuUsage()
            assert.deepEqual(cpu, { usage: 42.75 })
        })

        it('returns null when item has no value or item list is empty', async () => {
            const fetchFn = createFakeFetch(async () => ({ result: [] }))

            const adapter = new ZabbixAdapter({
                apiUrl: 'http://zabbix.local',
                apiToken: 'fake-token',
                hostId: '10084',
                fetchFn,
            })

            const cpu = await adapter.getCpuUsage()
            assert.equal(cpu, null)
        })

        it('returns null when API returns JSON-RPC error', async () => {
            const fetchFn = createFakeFetch(async () => ({
                error: { code: -32602, message: 'Invalid params' },
            }))

            const adapter = new ZabbixAdapter({
                apiUrl: 'http://zabbix.local',
                apiToken: 'fake-token',
                hostId: '10084',
                fetchFn,
            })

            const cpu = await adapter.getCpuUsage()
            assert.equal(cpu, null)
        })

        it('returns null when network throws an exception', async () => {
            const fetchFn = async () => {
                throw new Error('Connection refused')
            }

            const adapter = new ZabbixAdapter({
                apiUrl: 'http://zabbix.local',
                apiToken: 'fake-token',
                hostId: '10084',
                fetchFn,
            })

            const cpu = await adapter.getCpuUsage()
            assert.equal(cpu, null)
        })
    })

    describe('getActiveProblems', () => {
        it('maps active incidents with severities and labels', async () => {
            const fetchFn = createFakeFetch(async (_url, body) => {
                assert.equal(body.method, 'problem.get')
                return {
                    result: [
                        { eventid: '201', name: 'Zabbix agent unreachable', severity: '4', clock: '1700000000' },
                        { eventid: '202', name: 'High CPU load', severity: '3', clock: '1700000010' },
                    ],
                }
            })

            const adapter = new ZabbixAdapter({
                apiUrl: 'http://zabbix.local',
                apiToken: 'fake-token',
                hostId: '10084',
                fetchFn,
            })

            const problems = await adapter.getActiveProblems()
            assert.equal(problems.length, 2)
            assert.deepEqual(problems[0], {
                id: '201',
                name: 'Zabbix agent unreachable',
                severity: 4,
                severityLabel: 'High',
                timestamp: 1700000000000,
            })
            assert.equal(problems[1].severityLabel, 'Average')
        })

        it('returns empty array when no problems exist', async () => {
            const fetchFn = createFakeFetch(async () => ({ result: [] }))

            const adapter = new ZabbixAdapter({
                apiUrl: 'http://zabbix.local',
                apiToken: 'fake-token',
                hostId: '10084',
                fetchFn,
            })

            const problems = await adapter.getActiveProblems()
            assert.deepEqual(problems, [])
        })
    })
})
