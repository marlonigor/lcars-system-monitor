import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { NetworkRenderer } from './networkRenderer.js'
import { createFakeElement } from '../../test/FakeDOM.js'

describe('NetworkRenderer', () => {
    it('renders network metrics and interfaces', () => {
        const rxEl = createFakeElement('span')
        const txEl = createFakeElement('span')
        const rxUnitEl = createFakeElement('span')
        const txUnitEl = createFakeElement('span')
        const interfacesEl = createFakeElement('div')
        const peakLabel = createFakeElement('span')
        const canvas = createFakeElement('canvas')

        const renderer = new NetworkRenderer({
            rxEl,
            txEl,
            rxUnitEl,
            txUnitEl,
            interfacesEl,
            peakLabel,
            canvas,
        })

        renderer.render({
            network: {
                status: 'ok',
                data: {
                    rxSec: 2048,
                    txSec: 1024,
                    interfaces: [
                        { name: 'eth0', rxSec: 2048, txSec: 1024 },
                    ],
                },
            },
            history: [],
        })

        assert.equal(rxEl.textContent, '2.0')
        assert.equal(rxUnitEl.textContent, 'KB/s')
        assert.equal(txEl.textContent, '1.0')
        assert.equal(txUnitEl.textContent, 'KB/s')
        assert.equal(interfacesEl.innerHTML.includes('eth0'), true)
    })

    it('handles unavailable network status', () => {
        const rxEl = createFakeElement('span')
        const txEl = createFakeElement('span')
        const interfacesEl = createFakeElement('div')

        const renderer = new NetworkRenderer({ rxEl, txEl, interfacesEl })

        renderer.render({
            network: {
                status: 'unavailable',
                data: null,
            },
        })

        assert.equal(rxEl.textContent, 'N/A')
        assert.equal(txEl.textContent, 'N/A')
        assert.equal(interfacesEl.innerHTML, '')
    })
})
