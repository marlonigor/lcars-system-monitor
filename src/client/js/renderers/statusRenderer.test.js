import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { StatusRenderer } from './statusRenderer.js'
import { createFakeElement } from '../../test/FakeDOM.js'

describe('StatusRenderer', () => {
    it('updates connection state classes and label for connected', () => {
        const dotEl = createFakeElement('span')
        const textEl = createFakeElement('span')
        const reconnectBanner = createFakeElement('div')

        const renderer = new StatusRenderer({ dotEl, textEl, reconnectBanner })
        renderer.renderConnectionStatus('connected')

        assert.equal(dotEl.classList.contains('connected'), true)
        assert.equal(textEl.textContent, 'ONLINE')
        assert.equal(reconnectBanner.classList.contains('visible'), false)
    })

    it('updates connection state for disconnected', () => {
        const dotEl = createFakeElement('span')
        const textEl = createFakeElement('span')
        const reconnectBanner = createFakeElement('div')

        const renderer = new StatusRenderer({ dotEl, textEl, reconnectBanner })
        renderer.renderConnectionStatus('disconnected')

        assert.equal(dotEl.classList.contains('disconnected'), true)
        assert.equal(textEl.textContent, 'DISCONNECTED')
        assert.equal(reconnectBanner.classList.contains('visible'), true)
    })

    it('renders global metric status for ok, degraded and critical', () => {
        const systemStatusEl = createFakeElement('span')
        const timeEl = createFakeElement('span')

        const renderer = new StatusRenderer({ systemStatusEl, timeEl })

        renderer.renderMetricsStatus({ status: 'ok', timestamp: 1700000000000 })
        assert.equal(systemStatusEl.textContent, 'ALL SYSTEMS NOMINAL')

        renderer.renderMetricsStatus({ status: 'degraded' })
        assert.equal(systemStatusEl.textContent, 'DEGRADED MODE')

        renderer.renderMetricsStatus({ status: 'critical' })
        assert.equal(systemStatusEl.textContent, 'CRITICAL — SENSORS OFFLINE')
    })
})
