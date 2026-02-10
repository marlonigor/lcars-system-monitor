import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { SSEManager } from './sseManager.js'
import { EventEmitter } from 'node:events'

/**
 * Creates a mock Express response object for SSE testing.
 */
function createMockRes() {
    const emitter = new EventEmitter()
    const written = []

    return {
        writeHead: () => { },
        flushHeaders: () => { },
        write: (data) => {
            written.push(data)
            return true
        },
        on: (event, handler) => emitter.on(event, handler),
        emit: (event) => emitter.emit(event),
        _written: written,
    }
}

describe('SSEManager', () => {
    let manager

    beforeEach(() => {
        manager = new SSEManager()
    })

    afterEach(() => {
        // Clean up heartbeat interval
        manager._stopHeartbeat()
    })

    describe('addClient', () => {
        it('increases client count', () => {
            const res = createMockRes()
            manager.addClient(res)
            assert.equal(manager.clientCount, 1)
        })

        it('handles multiple clients', () => {
            manager.addClient(createMockRes())
            manager.addClient(createMockRes())
            manager.addClient(createMockRes())
            assert.equal(manager.clientCount, 3)
        })

        it('removes client on close event', () => {
            const res = createMockRes()
            manager.addClient(res)
            assert.equal(manager.clientCount, 1)

            res.emit('close')
            assert.equal(manager.clientCount, 0)
        })
    })

    describe('broadcast', () => {
        it('sends SSE-formatted data to all clients', () => {
            const res1 = createMockRes()
            const res2 = createMockRes()
            manager.addClient(res1)
            manager.addClient(res2)

            manager.broadcast({ test: true })

            const expected = 'data: {"test":true}\n\n'
            assert.equal(res1._written.at(-1), expected)
            assert.equal(res2._written.at(-1), expected)
        })

        it('does nothing with no clients', () => {
            // Should not throw
            manager.broadcast({ test: true })
            assert.equal(manager.clientCount, 0)
        })

        it('removes client that throws on write', () => {
            const badRes = createMockRes()
            badRes.write = () => {
                throw new Error('Connection reset')
            }
            manager.addClient(badRes)
            assert.equal(manager.clientCount, 1)

            manager.broadcast({ test: true })
            assert.equal(manager.clientCount, 0)
        })

        it('continues broadcasting to good clients after bad one', () => {
            const badRes = createMockRes()
            badRes.write = () => {
                throw new Error('dead')
            }
            const goodRes = createMockRes()

            manager.addClient(badRes)
            manager.addClient(goodRes)

            manager.broadcast({ alive: true })

            assert.equal(manager.clientCount, 1) // bad one removed
            assert.equal(goodRes._written.at(-1), 'data: {"alive":true}\n\n')
        })
    })

    describe('clientCount', () => {
        it('starts at 0', () => {
            assert.equal(manager.clientCount, 0)
        })

        it('reflects current connected clients', () => {
            const r1 = createMockRes()
            const r2 = createMockRes()
            manager.addClient(r1)
            manager.addClient(r2)
            assert.equal(manager.clientCount, 2)

            r1.emit('close')
            assert.equal(manager.clientCount, 1)

            r2.emit('close')
            assert.equal(manager.clientCount, 0)
        })
    })
})
