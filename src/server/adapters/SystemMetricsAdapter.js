/**
 * Abstract base class for system metrics adapters.
 * Defines the interface that all metric collection implementations must follow.
 */
export class SystemMetricsAdapter {
    async getCpuUsage() {
        throw new Error('Not implemented: getCpuUsage')
    }

    async getMemoryUsage() {
        throw new Error('Not implemented: getMemoryUsage')
    }

    async getProcesses() {
        throw new Error('Not implemented: getProcesses')
    }

    async getDiskUsage() {
        throw new Error('Not implemented: getDiskUsage')
    }
}
