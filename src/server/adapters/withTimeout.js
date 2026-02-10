/**
 * Wraps a promise with a timeout. Rejects if the promise doesn't resolve within `ms`.
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds (default 1000)
 * @returns {Promise} Resolves with the original value or rejects with TimeoutError
 */
export function withTimeout(promise, ms = 1000) {
    let timeoutId
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Timeout: operation exceeded ${ms}ms`))
        }, ms)
    })

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId)
    })
}
