/**
 * Lightweight mock server simulating Zabbix JSON-RPC 2.0 API.
 * Allows local end-to-end testing of telemetry and Red Alert triggers.
 *
 * Usage: node scripts/mock-zabbix-server.js [port]
 */

import http from 'node:http'

const PORT = parseInt(process.argv[2] || process.env.MOCK_ZABBIX_PORT || '8080', 10)

let currentAlertSeverity = 4
let currentCpuUsage = 78.5

const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || !req.url.endsWith('/api_jsonrpc.php')) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: 'Not found' }))
    }

    let rawBody = ''
    req.on('data', (chunk) => {
        rawBody += chunk
    })

    req.on('end', () => {
        const body = JSON.parse(rawBody || '{}')
        const response = handleJsonRpc(body)
        res.writeHead(200, { 'Content-Type': 'application/json-rpc' })
        res.end(JSON.stringify(response))
    })
})

function handleJsonRpc(body) {
    const { method, id } = body

    if (method === 'item.get') {
        return handleItemGet(id)
    }

    if (method === 'problem.get') {
        return handleProblemGet(id)
    }

    return { jsonrpc: '2.0', result: [], id }
}

function handleItemGet(id) {
    return {
        jsonrpc: '2.0',
        result: [
            {
                itemid: '1',
                key_: 'system.cpu.util',
                lastvalue: String(currentCpuUsage),
            },
            {
                itemid: '2',
                key_: 'vm.memory.size[total]',
                lastvalue: '17179869184',
            },
            {
                itemid: '3',
                key_: 'vm.memory.size[available]',
                lastvalue: '5153960755',
            },
            {
                itemid: '4',
                key_: 'vm.memory.util',
                lastvalue: '70.0',
            },
            {
                itemid: '5',
                key_: 'vfs.fs.size[/,total]',
                lastvalue: '1073741824000',
            },
            {
                itemid: '6',
                key_: 'vfs.fs.size[/,used]',
                lastvalue: '536870912000',
            },
            {
                itemid: '7',
                key_: 'vfs.fs.size[/,free]',
                lastvalue: '536870912000',
            },
            {
                itemid: '8',
                key_: 'vfs.fs.size[/,pused]',
                lastvalue: '50.0',
            },
        ],
        id,
    }
}

function handleProblemGet(id) {
    const result =
        currentAlertSeverity >= 3
            ? [
                  {
                      eventid: '9901',
                      name: 'Warp core plasma temperature above threshold',
                      severity: String(currentAlertSeverity),
                      clock: String(Math.floor(Date.now() / 1000)),
                  },
              ]
            : []

    return { jsonrpc: '2.0', result, id }
}

server.listen(PORT, () => {
    console.log(`[mock-zabbix] Listening on port ${PORT}`)
})
