/**
 * SSE Client with auto-reconnect and circuit breaker.
 *
 * - Backoff: 1s → 2s → 4s → ... → 30s (cap)
 * - Circuit breaker: max 10 retries → 'disconnected' state
 * - Callbacks: onData(metrics), onStatus('connected'|'reconnecting'|'disconnected')
 */

const MAX_RETRIES = 10
const MAX_BACKOFF = 30_000
const INITIAL_BACKOFF = 1000

export class SSEClient {
    constructor(url = '/api/metrics/stream') {
        this._url = url
        this._eventSource = null
        this._retryCount = 0
        this._lastData = null
        this._onData = null
        this._onStatus = null
        this._backoff = INITIAL_BACKOFF
        this._reconnectTimeout = null
    }

    /**
     * @param {(data: object) => void} onData
     * @param {(status: string) => void} onStatus
     */
    connect(onData, onStatus) {
        this._onData = onData
        this._onStatus = onStatus
        this._open()
    }

    /** Manual reconnect (used by the reconnect button after circuit breaker trips) */
    reconnect() {
        this._retryCount = 0
        this._backoff = INITIAL_BACKOFF
        this._open()
    }

    /** Returns last received data (used during reconnection) */
    get lastData() {
        return this._lastData
    }

    _open() {
        this._close()
        this._onStatus?.('reconnecting')

        this._eventSource = new EventSource(this._url)

        this._eventSource.onopen = () => {
            this._retryCount = 0
            this._backoff = INITIAL_BACKOFF
            this._onStatus?.('connected')
        }

        this._eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                this._lastData = data
                this._retryCount = 0
                this._onData?.(data)
            } catch {
                console.error('Failed to parse SSE data:', event.data)
            }
        }

        this._eventSource.onerror = () => {
            this._close()
            this._retryCount++

            if (this._retryCount >= MAX_RETRIES) {
                this._onStatus?.('disconnected')
                return
            }

            this._onStatus?.('reconnecting')
            this._reconnectTimeout = setTimeout(() => this._open(), this._backoff)
            this._backoff = Math.min(this._backoff * 2, MAX_BACKOFF)
        }
    }

    _close() {
        if (this._eventSource) {
            this._eventSource.close()
            this._eventSource = null
        }
        if (this._reconnectTimeout) {
            clearTimeout(this._reconnectTimeout)
            this._reconnectTimeout = null
        }
    }
}
