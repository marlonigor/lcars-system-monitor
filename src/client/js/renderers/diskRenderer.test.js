import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DiskRenderer } from './diskRenderer.js'
import { createFakeElement } from '../../test/FakeDOM.js'

describe('DiskRenderer', () => {
    it('renders storage cards for active volumes', () => {
        const listEl = createFakeElement('div')
        const renderer = new DiskRenderer({ listEl })

        renderer.render({
            disk: {
                status: 'ok',
                data: [
                    {
                        mount: 'C:',
                        used: 536870912000,
                        size: 1073741824000,
                        percentage: 50.0,
                    },
                ],
            },
        })

        assert.equal(listEl.innerHTML.includes('C:'), true)
        assert.equal(listEl.innerHTML.includes('500.0 / 1000.0 GB'), true)
        assert.equal(listEl.innerHTML.includes('width: 50%'), true)
    })

    it('displays offline indicator when storage metric is unavailable', () => {
        const listEl = createFakeElement('div')
        const renderer = new DiskRenderer({ listEl })

        renderer.render({
            disk: {
                status: 'unavailable',
                data: null,
            },
        })

        assert.equal(listEl.innerHTML.includes('STORAGE OFFLINE'), true)
    })

    it('displays empty volume indicator when data array is empty', () => {
        const listEl = createFakeElement('div')
        const renderer = new DiskRenderer({ listEl })

        renderer.render({
            disk: {
                status: 'ok',
                data: [],
            },
        })

        assert.equal(listEl.innerHTML.includes('NO VOLUMES DETECTED'), true)
    })
})
