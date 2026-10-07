import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ProcessRenderer } from './processRenderer.js'
import { createFakeElement } from '../../test/FakeDOM.js'

describe('ProcessRenderer', () => {
    it('renders list of processes sorted by default (CPU)', () => {
        const listEl = createFakeElement('div')
        const totalCountEl = createFakeElement('span')
        const toggleEl = createFakeElement('div')

        const renderer = new ProcessRenderer({ listEl, totalCountEl, toggleEl })

        renderer.render({
            processes: {
                status: 'ok',
                data: {
                    totalCount: 42,
                    byCpu: [
                        { pid: 101, name: 'warp_core.exe', cpu: 15.5, memory: 2.1 },
                        { pid: 102, name: 'transporter.exe', cpu: 8.3, memory: 1.4 },
                    ],
                    byMemory: [
                        { pid: 101, name: 'warp_core.exe', cpu: 15.5, memory: 2.1 },
                    ],
                },
            },
        })

        assert.equal(totalCountEl.textContent, 42)
        assert.equal(listEl.innerHTML.includes('warp_core.exe'), true)
        assert.equal(listEl.innerHTML.includes('15.5'), true)
        assert.equal(listEl.innerHTML.includes('transporter.exe'), true)
    })

    it('handles offline processes status gracefully', () => {
        const listEl = createFakeElement('div')
        const totalCountEl = createFakeElement('span')

        const renderer = new ProcessRenderer({ listEl, totalCountEl })

        renderer.render({
            processes: {
                status: 'unavailable',
                data: null,
            },
        })

        assert.equal(totalCountEl.textContent, 'N/A')
        assert.equal(listEl.innerHTML.includes('PROCESS SCANNER OFFLINE'), true)
    })
})
