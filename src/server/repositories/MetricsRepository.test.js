import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MetricsRepository } from './MetricsRepository.js'

/**
 * Creates a mock adapter with configurable responses.
 * Each method can be set to resolve, reject, or return null.
 */
function createMockAdapter(overrides = {}) {
    return {
        getCpuUsage: overrides.getCpuUsage ?? (async () => ({ usage: 25.5 })),
        getMemoryUsage:
            overrides.getMemoryUsage ??
            (async () => ({
                total: 16_000_000_000,
                used: 8_000_000_000,
                free: 8_000_000_000,
                percentage: 50.0,
            })),
        getProcesses:
            overrides.getProcesses ??
            (async () => ({
                byCpu: [{ pid: 1, name: 'test', cpu: 10, memory: 5, memRss: 100 }],
                byMemory: [{ pid: 1, name: 'test', cpu: 10, memory: 5, memRss: 100 }],
                totalCount: 100,
            })),
        getDiskUsage:
            overrides.getDiskUsage ??
            (async () => [
                {
                    fs: 'C:',
                    mount: 'C:',
                    type: 'NTFS',
                    size: 500_000_000_000,
                    used: 250_000_000_000,
                    available: 250_000_000_000,
                    percentage: 50.0,
                },
            ]),
        getNetworkStats:
            overrides.getNetworkStats ??
            (async () => ({ rxSec: 1000, txSec: 500, interfaces: [] })),
        getSystemInfo:
            overrides.getSystemInfo ??
            (async () => ({
                hostname: 'test-host',
                platform: 'win32',
                arch: 'x64',
                uptime: 3600,
                uptimeFormatted: '1h 0m',
                cpuModel: 'Test CPU',
                cpuCores: 4,
            })),
    }
}

describe('MetricsRepository', () => {
    describe('all metrics succeed', () => {
        it('returns ok status for all metrics', async () => {
            const repo = new MetricsRepository(createMockAdapter(), createMockAdapter())
            const result = await repo.getSystemMetrics()

            assert.equal(result.cpu.status, 'ok')
            assert.equal(result.memory.status, 'ok')
            assert.equal(result.disk.status, 'ok')
            assert.equal(result.processes.status, 'ok')
        })

        it('returns correct data shapes', async () => {
            const repo = new MetricsRepository(createMockAdapter(), createMockAdapter())
            const result = await repo.getSystemMetrics()

            assert.equal(result.cpu.data.usage, 25.5)
            assert.equal(result.memory.data.total, 16_000_000_000)
            assert.equal(result.memory.data.percentage, 50.0)
            assert.equal(result.disk.data[0].mount, 'C:')
            assert.equal(result.processes.data.totalCount, 100)
        })
    })

    describe('adapter returns null', () => {
        it('marks metric as unavailable when adapter returns null', async () => {
            const nodeAdapter = createMockAdapter({ getCpuUsage: async () => null })
            const repo = new MetricsRepository(nodeAdapter, createMockAdapter())
            const result = await repo.getSystemMetrics()

            assert.equal(result.cpu.status, 'unavailable')
            assert.equal(result.cpu.data, null) // no lastKnown yet
            assert(result.cpu.error)
        })

        it('uses lastKnown fallback on subsequent null', async () => {
            const calls = { count: 0 }
            const nodeAdapter = createMockAdapter({
                getCpuUsage: async () => {
                    calls.count++
                    return calls.count === 1 ? { usage: 42 } : null
                },
            })

            const repo = new MetricsRepository(nodeAdapter, createMockAdapter())

            // First call: ok, stores lastKnown
            const r1 = await repo.getSystemMetrics()
            assert.equal(r1.cpu.status, 'ok')
            assert.equal(r1.cpu.data.usage, 42)

            // Second call: null, falls back to lastKnown
            const r2 = await repo.getSystemMetrics()
            assert.equal(r2.cpu.status, 'unavailable')
            assert.deepEqual(r2.cpu.data, { usage: 42 })
        })
    })

    describe('adapter throws exception', () => {
        it('marks metric as unavailable on exception', async () => {
            const nodeAdapter = createMockAdapter({
                getCpuUsage: async () => {
                    throw new Error('Hardware failure')
                },
            })
            const repo = new MetricsRepository(nodeAdapter, createMockAdapter())
            const result = await repo.getSystemMetrics()

            assert.equal(result.cpu.status, 'unavailable')
            assert.equal(result.cpu.data, null)
            assert(result.cpu.error.includes('Hardware failure'))
        })

        it('other metrics still resolve when one fails', async () => {
            const nodeAdapter = createMockAdapter({
                getCpuUsage: async () => {
                    throw new Error('CPU dead')
                },
            })
            const repo = new MetricsRepository(nodeAdapter, createMockAdapter())
            const result = await repo.getSystemMetrics()

            assert.equal(result.cpu.status, 'unavailable')
            assert.equal(result.memory.status, 'ok') // memory still works
            assert.equal(result.disk.status, 'ok')
            assert.equal(result.processes.status, 'ok')
        })
    })

    describe('adapter times out', () => {
        it('marks metric as degraded on timeout', async () => {
            const nodeAdapter = createMockAdapter({
                getCpuUsage: () => new Promise((resolve) => setTimeout(() => resolve({ usage: 1 }), 5000)),
            })
            const repo = new MetricsRepository(nodeAdapter, createMockAdapter())
            const result = await repo.getSystemMetrics()

            assert.equal(result.cpu.status, 'degraded')
            assert(result.cpu.error.includes('Timeout'))
        })
    })

    describe('_lastKnown initialization', () => {
        it('starts with all null defaults', async () => {
            const allNull = createMockAdapter({
                getCpuUsage: async () => null,
                getMemoryUsage: async () => null,
                getProcesses: async () => null,
                getDiskUsage: async () => null,
                getNetworkStats: async () => null,
                getSystemInfo: async () => null,
            })

            const repo = new MetricsRepository(allNull, allNull)
            const result = await repo.getSystemMetrics()

            assert.equal(result.cpu.data, null)
            assert.equal(result.memory.data, null)
            assert.equal(result.disk.data, null)
            assert.equal(result.processes.data, null)
            assert.equal(result.network.data, null)
            assert.equal(result.systemInfo.data, null)
        })

        it('only updates lastKnown with non-null data', async () => {
            let cpuCallCount = 0
            const nodeAdapter = createMockAdapter({
                getCpuUsage: async () => {
                    cpuCallCount++
                    if (cpuCallCount === 1) return { usage: 50 }
                    if (cpuCallCount === 2) return null
                    return { usage: 75 }
                },
            })

            const repo = new MetricsRepository(nodeAdapter, createMockAdapter())

            // Call 1: stores { usage: 50 }
            await repo.getSystemMetrics()

            // Call 2: returns null, lastKnown still { usage: 50 }
            const r2 = await repo.getSystemMetrics()
            assert.deepEqual(r2.cpu.data, { usage: 50 })

            // Call 3: returns { usage: 75 }, updates lastKnown
            const r3 = await repo.getSystemMetrics()
            assert.equal(r3.cpu.status, 'ok')
            assert.deepEqual(r3.cpu.data, { usage: 75 })
        })
    })
})
