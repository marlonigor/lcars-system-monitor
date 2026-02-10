import logger from '../logger.js'

const log = logger.child({ layer: 'sse' })

/**
 * Manages active SSE connections, broadcasting metrics and heartbeats.
 */
export class SSEManager {
    constructor() {
        this._clients = new Set()
        this._heartbeatInterval = null
    }

    /**
     * Registers a new SSE client (Express response object).
     * Sets appropriate headers and starts heartbeat if first client.
     */
    addClient(res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        })

        // Flush headers immediately
        res.flushHeaders()

        this._clients.add(res)
        log.info({ clientCount: this._clients.size }, 'SSE client connected')

        res.on('close', () => {
            this._clients.delete(res)
            log.info({ clientCount: this._clients.size }, 'SSE client disconnected')

            if (this._clients.size === 0) {
                this._stopHeartbeat()
            }
        })

        if (this._clients.size === 1) {
            this._startHeartbeat()
        }
    }

    /**
     * Broadcasts data to all connected clients.
     * @param {object} data - JSON-serializable data
     */
    broadcast(data) {
        const payload = `data: ${JSON.stringify(data)}\n\n`

        for (const client of this._clients) {
            try {
                client.write(payload)
            } catch (err) {
                log.error({ err }, 'Failed to write to SSE client')
                this._clients.delete(client)
            }
        }
    }

    /**
     * Sends SSE comment heartbeat every 15s to keep connections alive.
     * Browser EventSource ignores lines starting with `:`.
     */
    _startHeartbeat() {
        this._heartbeatInterval = setInterval(() => {
            for (const client of this._clients) {
                try {
                    client.write(':heartbeat\n\n')
                } catch {
                    this._clients.delete(client)
                }
            }
        }, 15_000)
    }

    _stopHeartbeat() {
        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval)
            this._heartbeatInterval = null
        }
    }

    get clientCount() {
        return this._clients.size
    }
}
