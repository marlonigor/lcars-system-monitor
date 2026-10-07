/**
 * Minimal Fake Element implementation for headless renderer testing.
 * Avoids heavy browser/DOM dependencies while providing predictable behavior.
 * @param {string} tagName
 * @returns {object}
 */
export function createFakeElement(tagName = 'div') {
    const classSet = new Set()
    const styles = {}
    const datasets = {}
    const listeners = {}
    const children = []

    return {
        tagName: tagName.toUpperCase(),
        textContent: '',
        innerHTML: '',
        style: styles,
        dataset: datasets,
        children,
        classList: {
            add: (...names) => names.forEach((n) => classSet.add(n)),
            remove: (...names) => names.forEach((n) => classSet.delete(n)),
            toggle: (name, force) => {
                const add = force !== undefined ? force : !classSet.has(name)
                add ? classSet.add(name) : classSet.delete(name)
                return add
            },
            contains: (name) => classSet.has(name),
            get className() {
                return Array.from(classSet).join(' ')
            },
        },
        addEventListener(event, handler) {
            listeners[event] = listeners[event] || []
            listeners[event].push(handler)
        },
        dispatchEvent(event) {
            const handlers = listeners[event.type] || []
            handlers.forEach((h) => h(event))
        },
        appendChild(child) {
            children.push(child)
            return child
        },
        append(...items) {
            children.push(...items)
        },
        closest: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        getBoundingClientRect: () => ({ width: 600, height: 150 }),
        getContext: () => createFakeCanvasContext(),
    }
}

/**
 * Creates a minimal 2D canvas context mock for chart renderers.
 * @returns {object}
 */
export function createFakeCanvasContext() {
    return {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        fillRect: () => {},
        clearRect: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        scale: () => {},
    }
}
