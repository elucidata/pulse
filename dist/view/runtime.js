import { effect as baseEffect, isReadonlySignal, } from "../internals";
export function effect(fn) {
    const dispose = baseEffect(fn);
    if (cleanupStack.length > 0) {
        cleanupStack[cleanupStack.length - 1]?.push(dispose);
    }
}
// Context system
export const contextStack = [];
export function setContext(key, value) {
    if (contextStack.length === 0) {
        throw new Error("setContext must be called within a component");
    }
    contextStack[contextStack.length - 1]?.set(key, value);
}
export function getContext(key) {
    for (let i = contextStack.length - 1; i >= 0; i--) {
        if (contextStack[i]?.has(key)) {
            return contextStack[i]?.get(key);
        }
    }
    throw new Error("Context not found for key");
}
// Lifecycle hooks
export const cleanupStack = [];
export function onMount(fn) {
    if (cleanupStack.length === 0) {
        throw new Error("onMount must be called within a component");
    }
    queueMicrotask(() => {
        const unmount = fn();
        if (unmount) {
            onUnmount(unmount);
        }
    });
}
export function onUnmount(fn) {
    if (cleanupStack.length === 0) {
        throw new Error("onUnmount must be called within a component");
    }
    cleanupStack[cleanupStack.length - 1]?.push(fn);
}
// JSX-compatible createElement function
export function h(tag, props, ...children) {
    if (typeof tag === "function") {
        // Component function
        const { node } = createComponent(tag, props, children);
        return node;
    }
    const el = document.createElement(tag);
    if (props) {
        for (const [key, value] of Object.entries(props)) {
            if (key === "children") {
                continue;
            }
            else if (key.startsWith("on")) {
                const eventName = key.slice(2).toLowerCase();
                el.addEventListener(eventName, value);
            }
            else if (key === "style" && typeof value === "object") {
                Object.assign(el.style, value);
            }
            else if (key === "use" && typeof value === "function") {
                value(el);
            }
            else if (typeof value === "function") {
                // Reactive attribute
                reactiveAttributeEffect(el, key, () => value());
            }
            else if (isReadonlySignal(value)) {
                // Reactive attribute using signal
                reactiveAttributeEffect(el, key, () => value.value);
            }
            else {
                el.setAttribute(key, value);
            }
        }
    }
    const allChildren = props?.children
        ? Array.isArray(props.children)
            ? props.children
            : [props.children]
        : [];
    allChildren.push(...children);
    for (const child of allChildren) {
        appendChild(el, child);
    }
    return el;
}
function reactiveAttributeEffect(el, key, worker) {
    effect(() => {
        const newValue = worker();
        if (newValue === false || newValue == null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, String(newValue));
        }
        // Return a cleanup function to remove the attribute on disposal
        return () => {
            el.removeAttribute(key);
        };
    });
}
// Helper function to append children to a parent node
export function appendChild(parent, child, disposes) {
    if (Array.isArray(child)) {
        child.forEach((c) => appendChild(parent, c, disposes));
    }
    else if (typeof child === "function") {
        reactiveChildContent(parent, () => child());
    }
    else if (isReadonlySignal(child)) {
        reactiveChildContent(parent, () => child.value);
    }
    else if (child &&
        typeof child === "object" &&
        "node" in child &&
        "dispose" in child) {
        // Child is a component object
        parent.appendChild(child.node);
        // Collect dispose function
        if (disposes) {
            disposes.push(child.dispose);
        }
        else {
            // Add the dispose function to the current cleanup stack
            if (cleanupStack.length > 0) {
                cleanupStack[cleanupStack.length - 1]?.push(child.dispose);
            }
        }
    }
    else if (child instanceof Node) {
        parent.appendChild(child);
    }
    else if (child !== null && child !== undefined) {
        parent.appendChild(document.createTextNode(String(child)));
    }
}
function reactiveChildContent(parent, worker) {
    // Create boundary markers
    let start = document.createComment("start");
    let end = document.createComment("end");
    parent.appendChild(start);
    parent.appendChild(end);
    effect(() => {
        // Create a cleanupFns array for this effect
        const cleanupFns = [];
        cleanupStack.push(cleanupFns);
        const value = worker();
        // Prepare disposer list
        let disposes = [];
        const fragment = document.createDocumentFragment();
        appendChild(fragment, value, disposes);
        // Insert new content
        end.parentNode.insertBefore(fragment, end);
        // Now pop the cleanupStack after cleanups are done
        // cleanupStack.pop();
        // Do not pop the cleanupStack here?
        // Keep it until the effect's cleanup function runs
        // Return a cleanup function to remove inserted nodes and dispose components on disposal
        return () => {
            // Remove inserted nodes
            const range = document.createRange();
            range.setStartAfter(start);
            range.setEndBefore(end);
            range.deleteContents();
            // Dispose components
            disposes.forEach((dispose) => dispose());
            // Also call cleanup functions
            for (const fn of cleanupFns) {
                fn();
            }
            // Now pop the cleanupStack after cleanups are done
            cleanupStack.pop();
        };
    });
}
// Component creation with context and cleanup management
export function createComponent(component, props, children) {
    const contextMap = new Map();
    contextStack.push(contextMap);
    const cleanupFns = [];
    // Capture the parent's cleanup functions
    const parentCleanupFns = cleanupStack[cleanupStack.length - 1];
    cleanupStack.push(cleanupFns);
    const result = component(props, children);
    const fragment = document.createDocumentFragment();
    if (Array.isArray(result)) {
        result.forEach((node) => {
            appendChild(fragment, node);
        });
    }
    else if (result instanceof Node) {
        fragment.appendChild(result);
    }
    else if (result !== null && result !== undefined) {
        fragment.appendChild(document.createTextNode(String(result)));
    }
    else {
        fragment.appendChild(document.createComment(""));
    }
    let isDisposed = false;
    const dispose = () => {
        if (isDisposed) {
            return console.warn("Component already unmounted");
        }
        for (const fn of cleanupFns) {
            fn();
        }
        contextStack.pop();
        cleanupStack.pop();
        isDisposed = true;
    };
    // Add the dispose function to the parent's cleanup functions
    if (parentCleanupFns) {
        parentCleanupFns.push(dispose);
    }
    return { node: fragment, dispose };
}
// Render function to mount components
export function render(component, container) {
    const { node, dispose } = createComponent(component, null, []);
    const startMarker = document.createComment("start of component");
    const endMarker = document.createComment("end of component");
    container.appendChild(startMarker);
    container.appendChild(node);
    container.appendChild(endMarker);
    let isDisposed = false;
    return () => {
        if (isDisposed) {
            return console.warn("Render root already unmounted");
        }
        const range = document.createRange();
        range.setStartAfter(startMarker);
        range.setEndBefore(endMarker);
        range.deleteContents();
        container.removeChild(startMarker);
        container.removeChild(endMarker);
        dispose();
        isDisposed = true;
    };
}
//# sourceMappingURL=runtime.js.map