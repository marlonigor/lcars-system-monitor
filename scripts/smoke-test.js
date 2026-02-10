/**
 * Smoke Test — validates backend API schema and values.
 *
 * Usage: node scripts/smoke-test.js
 * - Spawns the server, waits for initialization
 * - Tests GET /api/metrics (schema + value assertions)
 * - Tests GET /api/metrics/stream (SSE event parsing)
 * - Exit 0 on success, exit 1 on failure
 */

import { spawn } from 'node:child_process'
import { strict as assert } from 'node:assert'

const PORT = 3099 // Use different port to avoid conflicts
const BASE = `http://localhost:${PORT}`

let serverProcess = null

function log(msg) {
    console.log(`[smoke-test] ${msg}`)
}

function fail(msg) {
    console.error(`[smoke-test] ❌ FAIL: ${msg}`)
    cleanup()
    process.exit(1)
}

function cleanup() {
    if (serverProcess) {
        serverProcess.kill('SIGTERM')
    }
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

async function startServer() {
    return new Promise((resolve, reject) => {
        serverProcess = spawn('node', ['src/server/index.js'], {
            env: { ...process.env, PORT: String(PORT), LOG_LEVEL: 'warn' },
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        serverProcess.on('error', (err) => {
            reject(new Error(`Failed to start server: ${err.message}`))
        })

        let output = ''
        serverProcess.stdout.on('data', (data) => {
            output += data.toString()
            if (output.includes('started') || output.includes(String(PORT))) {
                resolve()
            }
        })

        // Fallback: resolve after 3s (server should be ready by then)
        setTimeout(resolve, 3000)
    })
}

async function testMetricsEndpoint() {
    log('Testing GET /api/metrics ...')

    // Wait for 2nd collection cycle (CPU needs delta)
    await new Promise((r) => setTimeout(r, 3000))

    const res = await fetch(`${BASE}/api/metrics`)
    assert.equal(res.status, 200, 'Expected status 200')

    const data = await res.json()

    // Schema assertions
    assert(typeof data.timestamp === 'number' && data.timestamp > 0, 'timestamp must be positive number')
    assert(['ok', 'degraded', 'critical'].includes(data.status), `Invalid global status: ${data.status}`)

    // Per-metric status
    for (const key of ['cpu', 'memory', 'disk', 'processes']) {
        assert(data[key], `Missing metric: ${key}`)
        assert(
            ['ok', 'degraded', 'unavailable'].includes(data[key].status),
            `Invalid ${key}.status: ${data[key].status}`,
        )
    }

    // Value assertions (when data is available)
    if (data.memory.data) {
        assert(data.memory.data.total > 0, 'memory.total must be > 0')
        assert(data.memory.data.used >= 0, 'memory.used must be >= 0')
        assert(data.memory.data.used <= data.memory.data.total, 'memory.used must be <= total')
        assert(
            data.memory.data.percentage >= 0 && data.memory.data.percentage <= 100,
            'memory.percentage must be 0-100',
        )
    }

    if (data.cpu.data) {
        assert(
            data.cpu.data.usage >= 0 && data.cpu.data.usage <= 100,
            `cpu.usage out of range: ${data.cpu.data.usage}`,
        )
    }

    // History
    assert(Array.isArray(data.history), 'history must be array')

    log(`  ✅ Schema valid (status: ${data.status})`)
    log(`  ✅ CPU: ${data.cpu.data?.usage ?? 'N/A'}%`)
    log(`  ✅ Memory: ${data.memory.data ? Math.round(data.memory.data.used / 1e9) + 'GB' : 'N/A'}`)
    log(`  ✅ Disks: ${data.disk.data?.length ?? 'N/A'} volumes`)
    log(`  ✅ Processes: ${data.processes.data?.totalCount ?? 'N/A'} total`)
}

async function testSSEStream() {
    log('Testing GET /api/metrics/stream (SSE) ...')

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            controller.abort()
            reject(new Error('SSE timeout: no event received in 5s'))
        }, 5000)

        const controller = new AbortController()

        fetch(`${BASE}/api/metrics/stream`, { signal: controller.signal })
            .then(async (res) => {
                assert.equal(res.status, 200, 'SSE expected 200')
                assert(
                    res.headers.get('content-type')?.includes('text/event-stream'),
                    'SSE Content-Type must be text/event-stream',
                )

                const reader = res.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ''

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })

                    // Look for a complete SSE data line
                    const match = buffer.match(/^data: (.+)$/m)
                    if (match) {
                        const eventData = JSON.parse(match[1])
                        assert(eventData.timestamp, 'SSE event must have timestamp')
                        assert(eventData.status, 'SSE event must have status')

                        clearTimeout(timeout)
                        controller.abort()
                        log('  ✅ SSE event received and parsed')
                        resolve()
                        return
                    }
                }
            })
            .catch((err) => {
                if (err.name === 'AbortError') return
                clearTimeout(timeout)
                reject(err)
            })
    })
}

// --- Run ---

async function main() {
    log('Starting LCARS System Monitor smoke test...')

    try {
        log('Starting server on port ' + PORT + '...')
        await startServer()
        log('Server started')

        await testMetricsEndpoint()
        await testSSEStream()

        log('')
        log('🎉 All smoke tests passed!')
        cleanup()
        process.exit(0)
    } catch (err) {
        fail(err.message || String(err))
    }
}

main()
