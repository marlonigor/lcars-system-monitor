import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NodeNativeAdapter } from './NodeNativeAdapter.js'

describe('NodeNativeAdapter', () => {
    let adapter

    beforeEach(() => {
        adapter = new NodeNativeAdapter()
    })

    describe('getCpuUsage', () => {
        it('returns null on first call (no delta)', async () => {
            const result = await adapter.getCpuUsage()
            assert.equal(result, null)
        })

        it('returns usage percentage on second call', async () => {
            await adapter.getCpuUsage() // first call — seeds ticks
            const result = await adapter.getCpuUsage() // second call — has delta

            assert.notEqual(result, null, 'Second call should return data')
            assert.equal(typeof result.usage, 'number')
            assert(result.usage >= 0, `usage should be >= 0, got ${result.usage}`)
            assert(result.usage <= 100, `usage should be <= 100, got ${result.usage}`)
        })

        it('returns consistent data shape on subsequent calls', async () => {
            await adapter.getCpuUsage()
            const r1 = await adapter.getCpuUsage()
            const r2 = await adapter.getCpuUsage()

            assert.notEqual(r1, null)
            assert.notEqual(r2, null)
            assert.equal(typeof r1.usage, 'number')
            assert.equal(typeof r2.usage, 'number')
        })

        it('usage is rounded to 2 decimal places', async () => {
            await adapter.getCpuUsage()
            const result = await adapter.getCpuUsage()

            if (result) {
                const decimals = result.usage.toString().split('.')[1]
                assert(
                    !decimals || decimals.length <= 2,
                    `Expected max 2 decimals, got ${result.usage}`,
                )
            }
        })
    })

    describe('getMemoryUsage', () => {
        it('returns memory metrics', async () => {
            const result = await adapter.getMemoryUsage()

            assert.equal(typeof result.total, 'number')
            assert.equal(typeof result.used, 'number')
            assert.equal(typeof result.free, 'number')
            assert.equal(typeof result.percentage, 'number')
        })

        it('total is greater than 0', async () => {
            const result = await adapter.getMemoryUsage()
            assert(result.total > 0)
        })

        it('used + free equals total', async () => {
            const result = await adapter.getMemoryUsage()
            assert.equal(result.used + result.free, result.total)
        })

        it('percentage is between 0 and 100', async () => {
            const result = await adapter.getMemoryUsage()
            assert(result.percentage >= 0)
            assert(result.percentage <= 100)
        })

        it('used is less than or equal to total', async () => {
            const result = await adapter.getMemoryUsage()
            assert(result.used <= result.total)
        })

        it('percentage is rounded to 2 decimal places', async () => {
            const result = await adapter.getMemoryUsage()
            const decimals = result.percentage.toString().split('.')[1]
            assert(!decimals || decimals.length <= 2)
        })
    })
})
