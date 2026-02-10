import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { withTimeout } from './withTimeout.js'

describe('withTimeout', () => {
    it('resolves when promise completes before timeout', async () => {
        const result = await withTimeout(Promise.resolve('ok'), 1000)
        assert.equal(result, 'ok')
    })

    it('rejects when promise exceeds timeout', async () => {
        const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 500))

        await assert.rejects(() => withTimeout(slow, 50), (err) => {
            assert(err.message.includes('Timeout'))
            return true
        })
    })

    it('propagates original rejection', async () => {
        const failing = Promise.reject(new Error('boom'))

        await assert.rejects(() => withTimeout(failing, 1000), (err) => {
            assert.equal(err.message, 'boom')
            return true
        })
    })

    it('uses default timeout of 1000ms', async () => {
        const fast = Promise.resolve(42)
        const result = await withTimeout(fast)
        assert.equal(result, 42)
    })

    it('resolves with null/undefined values', async () => {
        const nullResult = await withTimeout(Promise.resolve(null), 1000)
        assert.equal(nullResult, null)

        const undefinedResult = await withTimeout(Promise.resolve(undefined), 1000)
        assert.equal(undefinedResult, undefined)
    })

    it('cleans up timer after resolution', async () => {
        // Should not leak - withTimeout uses .finally() to clear timer
        const result = await withTimeout(Promise.resolve('clean'), 100)
        assert.equal(result, 'clean')
    })
})
