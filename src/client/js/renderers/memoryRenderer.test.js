import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryRenderer } from './memoryRenderer.js'
import { createFakeElement } from '../../test/FakeDOM.js'

describe('MemoryRenderer', () => {
    it('renders memory usage values and segment bars', () => {
        const usedEl = createFakeElement('span')
        const totalEl = createFakeElement('span')
        const freeEl = createFakeElement('span')
        const barFill = createFakeElement('div')
        const segmentsEl = createFakeElement('div')

        const renderer = new MemoryRenderer({
            usedEl,
            totalEl,
            freeEl,
            barFill,
            segmentsEl,
            createElement: (tag) => createFakeElement(tag),
        })

        renderer.render({
            memory: {
                status: 'ok',
                data: {
                    used: 8589934592,
                    total: 17179869184,
                    free: 8589934592,
                    percentage: 50.0,
                },
            },
        })

        assert.equal(usedEl.textContent, '8.0')
        assert.equal(totalEl.textContent, '16.0')
        assert.equal(freeEl.textContent, '8.0')
        assert.equal(barFill.style.width, '50%')
        assert.equal(segmentsEl.children.length, 2)
    })

    it('handles unavailable memory state', () => {
        const usedEl = createFakeElement('span')
        const totalEl = createFakeElement('span')
        const freeEl = createFakeElement('span')
        const barFill = createFakeElement('div')

        const renderer = new MemoryRenderer({ usedEl, totalEl, freeEl, barFill })

        renderer.render({
            memory: {
                status: 'unavailable',
                data: null,
            },
        })

        assert.equal(usedEl.textContent, 'N/A')
        assert.equal(totalEl.textContent, '--')
        assert.equal(freeEl.textContent, '--')
        assert.equal(barFill.style.width, '0%')
    })
})
