import express from 'express'
import cors from 'cors'
import { NodeNativeAdapter } from './adapters/NodeNativeAdapter.js'
import { SystemInformationAdapter } from './adapters/SystemInformationAdapter.js'
import { MetricsRepository } from './repositories/MetricsRepository.js'
import { SystemMonitorService } from './services/SystemMonitorService.js'
import { SSEManager } from './http/sseManager.js'
import { createRoutes } from './http/routes.js'
import logger from './logger.js'

const log = logger.child({ layer: 'http' })

// --- Composition Root ---

const nodeAdapter = new NodeNativeAdapter()
const siAdapter = new SystemInformationAdapter()
const repository = new MetricsRepository(nodeAdapter, siAdapter)
const service = new SystemMonitorService(repository)
const sseManager = new SSEManager()

// --- Express App ---

const app = express()
app.use(cors())
app.use(express.json())

const routes = createRoutes(service, sseManager)
app.use('/api', routes)

// --- Periodic Collection + SSE Broadcast ---

const COLLECT_INTERVAL = parseInt(process.env.COLLECT_INTERVAL || '2000', 10)
const MIN_INTERVAL = 500

const interval = Math.max(COLLECT_INTERVAL, MIN_INTERVAL)

setInterval(async () => {
    try {
        const metrics = await service.getCurrentMetrics()
        sseManager.broadcast(metrics)
    } catch (err) {
        log.error({ err }, 'Failed during periodic metrics collection')
    }
}, interval)

// --- Start Server ---

const PORT = parseInt(process.env.PORT || '3001', 10)

app.listen(PORT, () => {
    log.info({ port: PORT, interval }, 'LCARS System Monitor server started')
})
