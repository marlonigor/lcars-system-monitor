import { Router } from 'express'

/**
 * Creates Express routes for the metrics API.
 * @param {import('../services/SystemMonitorService.js').SystemMonitorService} service
 * @param {import('./sseManager.js').SSEManager} sseManager
 */
export function createRoutes(service, sseManager) {
    const router = Router()

    /**
     * GET /api/metrics — JSON snapshot of current system metrics.
     * Always returns 200, with per-metric status for partial failures.
     */
    router.get('/metrics', async (_req, res) => {
        try {
            const metrics = await service.getCurrentMetrics()
            res.json(metrics)
        } catch (err) {
            res.json({
                timestamp: Date.now(),
                status: 'critical',
                error: 'Failed to collect metrics',
                cpu: { status: 'unavailable', data: null },
                memory: { status: 'unavailable', data: null },
                disk: { status: 'unavailable', data: null },
                processes: { status: 'unavailable', data: null },
                history: [],
            })
        }
    })

    /**
     * GET /api/metrics/stream — SSE endpoint for real-time metric updates.
     * Optional query: ?interval=2000 (min 500ms)
     */
    router.get('/metrics/stream', (req, res) => {
        sseManager.addClient(res)

        // Send initial snapshot immediately
        service.getCurrentMetrics().then((metrics) => {
            try {
                res.write(`data: ${JSON.stringify(metrics)}\n\n`)
            } catch {
                // Client may have already disconnected
            }
        })
    })

    return router
}
