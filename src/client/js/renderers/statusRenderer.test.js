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

    it('activates Red Alert theme and renders incident banner', () => {
        const systemStatusEl = createFakeElement('span')
        const appRoot = createFakeElement('div')
        const incidentBanner = createFakeElement('div')

        const renderer = new StatusRenderer({ systemStatusEl, appRoot, incidentBanner })

        renderer.renderMetricsStatus({
            status: 'critical',
            alertLevel: 'red',
            alerts: [{ id: '99', name: 'Zabbix agent unreachable', severity: 4, severityLabel: 'High' }],
        })

        assert.equal(appRoot.classList.contains('alert-red'), true)
        assert.equal(incidentBanner.classList.contains('visible'), true)
        assert.equal(incidentBanner.textContent.includes('ZABBIX AGENT UNREACHABLE'), true)
        assert.equal(systemStatusEl.textContent.includes('RED ALERT'), true)
    })

    it('activates Yellow Alert theme and clears on nominal', () => {
        const systemStatusEl = createFakeElement('span')
        const appRoot = createFakeElement('div')
        const incidentBanner = createFakeElement('div')

        const renderer = new StatusRenderer({ systemStatusEl, appRoot, incidentBanner })

        renderer.renderMetricsStatus({
            status: 'degraded',
            alertLevel: 'yellow',
            alerts: [{ id: '98', name: 'Disk space warning', severity: 3, severityLabel: 'Average' }],
        })

        assert.equal(appRoot.classList.contains('alert-yellow'), true)
        assert.equal(systemStatusEl.textContent.includes('YELLOW ALERT'), true)

        renderer.renderMetricsStatus({
            status: 'ok',
            alertLevel: 'nominal',
            alerts: [],
        })

        assert.equal(appRoot.classList.contains('alert-yellow'), false)
        assert.equal(incidentBanner.classList.contains('visible'), false)
        assert.equal(systemStatusEl.textContent, 'ALL SYSTEMS NOMINAL')
    })
})
