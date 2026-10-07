import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CpuRenderer } from './cpuRenderer.js'
import { createFakeElement } from '../../test/FakeDOM.js'

describe('CpuRenderer', () => {
    it('renders usage percentage and updates bar fill', () => {
        const usageEl = createFakeElement('span')
        const barFill = createFakeElement('div')
        const canvas = createFakeElement('canvas')

        const renderer = new CpuRenderer({ usageEl, barFill, canvas })

        renderer.render({
            cpu: {
                status: 'ok',
                data: { usage: 45.67 },
            },
            history: [{ timestamp: 1, cpu: 45.67 }],
        })

        assert.equal(usageEl.textContent, '45.7')
        assert.equal(barFill.style.width, '45.67%')
    })

    it('renders N/A and resets bar fill when CPU is unavailable', () => {
        const usageEl = createFakeElement('span')
        const barFill = createFakeElement('div')
        const canvas = createFakeElement('canvas')

        const renderer = new CpuRenderer({ usageEl, barFill, canvas })

        renderer.render({
            cpu: {
                status: 'unavailable',
                data: null,
            },
            history: [],
        })

        assert.equal(usageEl.textContent, 'N/A')
        assert.equal(usageEl.classList.contains('lcars-unavailable'), true)
        assert.equal(barFill.style.width, '0%')
    })
})
