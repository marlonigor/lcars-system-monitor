/**
 * End-to-End Automated Test — Validates full Zabbix telemetry and Red Alert pipeline.
 *
 * Flow:
 * 1. Spawns mock Zabbix server on port 8088.
 * 2. Spawns LCARS monitor server with METRICS_SOURCE=zabbix on port 3098.
 * 3. Tests GET /api/metrics for Zabbix metrics and Red Alert escalation.
 * 4. Tests GET /api/metrics/stream for real-time SSE event delivery.
 * 5. Cleans up processes and exits 0 on success.
 *
 * Usage: node scripts/test-zabbix-e2e.js
 */

import { spawn } from 'node:child_process'
import http from 'node:http'
import { strict as assert } from 'node:assert'

const MOCK_PORT = 8088
const APP_PORT = 3098
const BASE = `http://localhost:${APP_PORT}`

let mockProcess = null
let appProcess = null

function log(msg) {
    console.log(`[zabbix-e2e] ${msg}`)
}

async function cleanup() {
    const procs = [appProcess, mockProcess].filter(Boolean)
    appProcess = null
    mockProcess = null

    for (const p of procs) {
        try {
            p.kill()
        } catch {
            // Process might have already exited
        }
    }

    if (procs.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 250))
    }
}

async function fail(msg) {
    console.error(`[zabbix-e2e] [FAIL] ${msg}`)
    await cleanup()
    process.exit(1)
}

process.on('SIGINT', async () => {
    await cleanup()
    process.exit(130)
})

process.on('SIGTERM', async () => {
    await cleanup()
    process.exit(143)
})

async function startMockServer() {
    return new Promise((resolve, reject) => {
        mockProcess = spawn('node', ['scripts/mock-zabbix-server.js', String(MOCK_PORT)], {
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        mockProcess.on('error', (err) => reject(new Error(`Failed to start mock: ${err.message}`)))

        mockProcess.stdout.on('data', (data) => {
            if (data.toString().includes('Listening')) {
                resolve()
            }
        })

        setTimeout(resolve, 2000)
    })
}

async function startAppServer() {
    return new Promise((resolve, reject) => {
        appProcess = spawn('node', ['src/server/index.js'], {
            env: {
                ...process.env,
                PORT: String(APP_PORT),
                METRICS_SOURCE: 'zabbix',
                ZABBIX_URL: `http://localhost:${MOCK_PORT}`,
                ZABBIX_TOKEN: 'e2e-token',
                ZABBIX_HOST_ID: '10084',
                LOG_LEVEL: 'warn',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        appProcess.on('error', (err) => reject(new Error(`Failed to start app: ${err.message}`)))

        let output = ''
        appProcess.stdout.on('data', (data) => {
            output += data.toString()
            if (output.includes('started') || output.includes(String(APP_PORT))) {
                resolve()
            }
        })

        setTimeout(resolve, 3000)
    })
}

async function testZabbixMetricsEndpoint() {
    log('Testing GET /api/metrics with Zabbix telemetry and Red Alert...')
    const res = await fetch(`${BASE}/api/metrics`)
    assert.equal(res.status, 200, 'HTTP status must be 200')

    const data = await res.json()

    assert.equal(data.status, 'critical', 'System status must escalate to critical')
    assert.equal(data.alertLevel, 'red', 'Alert level must be red')
    assert(Array.isArray(data.alerts) && data.alerts.length > 0, 'Must contain active Zabbix alerts')
    assert.equal(typeof data.cpu.data.usage, 'number', 'CPU usage must be numeric')
    assert.equal(typeof data.memory.data.total, 'number', 'Memory total must be numeric')
    assert(Array.isArray(data.disk.data) && data.disk.data.length > 0, 'Disks must contain volumes')

    log('  [PASS] Red Alert escalation validated')
    log(`  [PASS] CPU usage from Zabbix: ${data.cpu.data.usage}%`)
    log(`  [PASS] Memory total from Zabbix: ${(data.memory.data.total / 1e9).toFixed(1)} GB`)
    log(`  [PASS] Active Incident: ${data.alerts[0].name} [${data.alerts[0].severityLabel}]`)
}

function testZabbixSSEStream() {
    return new Promise((resolve, reject) => {
        log('Testing GET /api/metrics/stream SSE event delivery...')
        const timeout = setTimeout(() => {
            req.destroy()
            reject(new Error('SSE stream timed out'))
        }, 6000)

        const req = http.get(
            `${BASE}/api/metrics/stream`,
            { headers: { Accept: 'text/event-stream' } },
            (res) => {
                assert.equal(res.statusCode, 200, 'SSE status must be 200')
                assert(
                    res.headers['content-type']?.includes('text/event-stream'),
                    'Content-Type must be text/event-stream',
                )

                let buffer = ''
                res.on('data', (chunk) => {
                    buffer += chunk.toString()
                    const lines = buffer.split('\n')
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.slice(6).trim()
                            if (jsonStr) {
                                try {
                                    const parsed = JSON.parse(jsonStr)
                                    assert.equal(parsed.alertLevel, 'red', 'SSE payload alertLevel must be red')
                                    clearTimeout(timeout)
                                    log('  [PASS] SSE stream delivered Red Alert payload')
                                    req.destroy()
                                    resolve()
                                    return
                                } catch {
                                    // Chunk may be partial JSON, wait for next chunk
                                }
                            }
                        }
                    }
                })
            },
        )

        req.on('error', (err) => {
            if (err.code !== 'ECONNRESET') {
                clearTimeout(timeout)
                reject(err)
            }
        })
    })
}

async function main() {
    log('Starting Zabbix E2E integration test...')
    try {
        await startMockServer()
        log(`Mock Zabbix started on port ${MOCK_PORT}`)

        await startAppServer()
        log(`LCARS Monitor started on port ${APP_PORT} (METRICS_SOURCE=zabbix)`)

        await testZabbixMetricsEndpoint()
        await testZabbixSSEStream()

        log('')
        log('All Zabbix E2E integration tests passed successfully.')
        await cleanup()
        process.exit(0)
    } catch (err) {
        await fail(err.message)
    }
}

main()
