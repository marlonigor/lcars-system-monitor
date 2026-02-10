import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { SystemMonitorService } from './SystemMonitorService.js'

/**
 * Creates a mock repository with configurable metric responses.
 */
function createMockRepo(overrides = {}) {
    return {
        getSystemMetrics:
            overrides.getSystemMetrics ??
            (async () => ({
                cpu: { status: 'ok', data: { usage: 50 } },
                memory: { status: 'ok', data: { total: 16e9, used: 8e9, free: 8e9, percentage: 50 } },
                disk: { status: 'ok', data: [{ mount: 'C:', percentage: 50 }] },
                processes: {
                    status: 'ok',
                    data: { byCpu: [], byMemory: [], totalCount: 100 },
                },
            })),
    }
}

describe('SystemMonitorService', () => {
    let service

    beforeEach(() => {
        service = new SystemMonitorService(createMockRepo())
    })

    describe('getCurrentMetrics', () => {
        it('returns enriched metrics with timestamp and status', async () => {
            const result = await service.getCurrentMetrics()

            assert.equal(typeof result.timestamp, 'number')
            assert(result.timestamp > 0)
            assert.equal(result.status, 'ok')
            assert(result.cpu)
            assert(result.memory)
            assert(result.disk)
            assert(result.processes)
            assert(Array.isArray(result.history))
        })

        it('includes history in response', async () => {
            const result = await service.getCurrentMetrics()
            assert(Array.isArray(result.history))
            assert.equal(result.history.length, 1) // first call = 1 entry
        })
    })

    describe('ring buffer', () => {
        it('accumulates history entries', async () => {
            for (let i = 0; i < 5; i++) {
                await service.getCurrentMetrics()
            }
            const history = service.getHistory()
            assert.equal(history.length, 5)
        })

        it('caps at 60 entries', async () => {
            for (let i = 0; i < 70; i++) {
                await service.getCurrentMetrics()
            }
            const history = service.getHistory()
            assert.equal(history.length, 60)
        })

        it('overwrites oldest entries after 60', async () => {
            let callCount = 0
            const repo = createMockRepo({
                getSystemMetrics: async () => {
                    callCount++
                    return {
                        cpu: { status: 'ok', data: { usage: callCount } },
                        memory: { status: 'ok', data: { percentage: callCount } },
                        disk: { status: 'ok', data: [] },
                        processes: { status: 'ok', data: { byCpu: [], byMemory: [], totalCount: 0 } },
                    }
                },
            })

            const svc = new SystemMonitorService(repo)

            for (let i = 0; i < 65; i++) {
                await svc.getCurrentMetrics()
            }

            const history = svc.getHistory()
            assert.equal(history.length, 60)

            // Oldest should be entry 6 (entries 1-5 were overwritten)
            assert.equal(history[0].cpu, 6)
            // Newest should be entry 65
            assert.equal(history[59].cpu, 65)
        })

        it('returns history sorted by timestamp', async () => {
            for (let i = 0; i < 10; i++) {
                await service.getCurrentMetrics()
            }

            const history = service.getHistory()
            for (let i = 1; i < history.length; i++) {
                assert(
                    history[i].timestamp >= history[i - 1].timestamp,
                    'History must be sorted chronologically',
                )
            }
        })

        it('stores null for cpu/memory when metrics are unavailable', async () => {
            const repo = createMockRepo({
                getSystemMetrics: async () => ({
                    cpu: { status: 'unavailable', data: null },
                    memory: { status: 'unavailable', data: null },
                    disk: { status: 'ok', data: [] },
                    processes: { status: 'ok', data: { byCpu: [], byMemory: [], totalCount: 0 } },
                }),
            })

            const svc = new SystemMonitorService(repo)
            await svc.getCurrentMetrics()

            const history = svc.getHistory()
            assert.equal(history[0].cpu, null)
            assert.equal(history[0].memory, null)
        })
    })

    describe('global status matrix', () => {
        it('returns ok when all metrics are ok', async () => {
            const result = await service.getCurrentMetrics()
            assert.equal(result.status, 'ok')
        })

        it('returns degraded when one metric is unavailable', async () => {
            const repo = createMockRepo({
                getSystemMetrics: async () => ({
                    cpu: { status: 'ok', data: { usage: 50 } },
                    memory: { status: 'ok', data: { percentage: 50 } },
                    disk: { status: 'unavailable', data: null },
                    processes: { status: 'ok', data: { byCpu: [], byMemory: [], totalCount: 0 } },
                }),
            })

            const svc = new SystemMonitorService(repo)
            const result = await svc.getCurrentMetrics()
            assert.equal(result.status, 'degraded')
        })

        it('returns degraded when one metric is degraded', async () => {
            const repo = createMockRepo({
                getSystemMetrics: async () => ({
                    cpu: { status: 'degraded', data: { usage: 50 } },
                    memory: { status: 'ok', data: { percentage: 50 } },
                    disk: { status: 'ok', data: [] },
                    processes: { status: 'ok', data: { byCpu: [], byMemory: [], totalCount: 0 } },
                }),
            })

            const svc = new SystemMonitorService(repo)
            const result = await svc.getCurrentMetrics()
            assert.equal(result.status, 'degraded')
        })

        it('returns critical when all metrics are unavailable', async () => {
            const repo = createMockRepo({
                getSystemMetrics: async () => ({
                    cpu: { status: 'unavailable', data: null },
                    memory: { status: 'unavailable', data: null },
                    disk: { status: 'unavailable', data: null },
                    processes: { status: 'unavailable', data: null },
                }),
            })

            const svc = new SystemMonitorService(repo)
            const result = await svc.getCurrentMetrics()
            assert.equal(result.status, 'critical')
        })

        it('returns degraded (not critical) when mixed unavailable + ok', async () => {
            const repo = createMockRepo({
                getSystemMetrics: async () => ({
                    cpu: { status: 'unavailable', data: null },
                    memory: { status: 'unavailable', data: null },
                    disk: { status: 'unavailable', data: null },
                    processes: { status: 'ok', data: { byCpu: [], byMemory: [], totalCount: 0 } },
                }),
            })

            const svc = new SystemMonitorService(repo)
            const result = await svc.getCurrentMetrics()
            assert.equal(result.status, 'degraded')
        })
    })
})
