import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SystemInfoRenderer } from './systemInfoRenderer.js'
import { createFakeElement } from '../../test/FakeDOM.js'

describe('SystemInfoRenderer', () => {
    it('renders system info on first valid metrics payload', () => {
        const hostnameEl = createFakeElement('span')
        const platformEl = createFakeElement('span')
        const uptimeEl = createFakeElement('span')

        const renderer = new SystemInfoRenderer({ hostnameEl, platformEl, uptimeEl })

        renderer.render({
            systemInfo: {
                status: 'ok',
                data: {
                    hostname: 'uss-enterprise',
                    platform: 'linux',
                    arch: 'x64',
                    uptimeFormatted: '12d 4h',
                },
            },
        })

        assert.equal(hostnameEl.textContent, 'USS-ENTERPRISE')
        assert.equal(platformEl.textContent, 'LINUX x64')
        assert.equal(uptimeEl.textContent, 'UP 12d 4h')
    })

    it('ignores unavailable systemInfo metrics without throwing', () => {
        const hostnameEl = createFakeElement('span')
        const renderer = new SystemInfoRenderer({ hostnameEl })

        renderer.render({
            systemInfo: {
                status: 'unavailable',
                data: null,
            },
        })

        assert.equal(hostnameEl.textContent, '')
    })
})
