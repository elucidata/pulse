import { effect, isReadonlySignal } from "../internals"
import { ComponentFunction, PropsWithChildren } from "./types"

// Context system
export const contextStack: Map<any, any>[] = []

export function setContext(key: any, value: any) {
  if (contextStack.length === 0) {
    throw new Error("setContext must be called within a component")
  }
  contextStack[contextStack.length - 1]?.set(key, value)
}

export function getContext<T>(key: any): T {
  for (let i = contextStack.length - 1; i >= 0; i--) {
    if (contextStack[i]?.has(key)) {
      return contextStack[i]?.get(key)
    }
  }
  throw new Error("Context not found for key")
}

// Lifecycle hooks
export const cleanupStack: (() => void)[][] = []

export function onMount(fn: () => void | (() => void)) {
  if (cleanupStack.length === 0) {
    throw new Error("onMount must be called within a component")
  }
  queueMicrotask(() => {
    const unmount = fn()
    if (unmount) {
      onUnmount(unmount)
    }
  })
}

export function onUnmount(fn: () => void) {
  if (cleanupStack.length === 0) {
    throw new Error("onUnmount must be called within a component")
  }
  cleanupStack[cleanupStack.length - 1]?.push(fn)
}

// JSX-compatible createElement function
// Updated h function
export function h(
  tag: string | ComponentFunction,
  props: PropsWithChildren | null,
  ...children: any[]
): Node {
  if (typeof tag === "function") {
    // Component function
    return createComponent(tag, props, children)
  }

  const el = document.createElement(tag)

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key === "children") {
        continue
      } else if (key.startsWith("on")) {
        const eventName = key.slice(2).toLowerCase()
        el.addEventListener(eventName, value)
      } else if (key === "style" && typeof value === "object") {
        Object.assign(el.style, value)
      } else if (key === "use" && typeof value === "function") {
        value(el)
      } else if (typeof value === "function") {
        // Reactive attribute
        reactiveAttributeEffect(el, key, () => value())
      } else if (isReadonlySignal(value)) {
        // Reactive attribute using signal
        reactiveAttributeEffect(el, key, () => value.value)
      } else {
        el.setAttribute(key, value)
      }
    }
  }

  const allChildren = props?.children
    ? Array.isArray(props.children)
      ? props.children
      : [props.children]
    : []

  allChildren.push(...children)

  for (const child of allChildren) {
    appendChild(el, child)
  }

  return el
}

function reactiveAttributeEffect(el: HTMLElement, key: string, worker: () => any) {
  effect(() => {
    const newValue = worker()
    if (newValue === false || newValue == null) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, String(newValue))
    }
  })
}

// Helper function to append children to a parent node
export function appendChild(parent: Node, child: any): void {
  if (Array.isArray(child)) {
    child.forEach((c) => appendChild(parent, c))
  } else if (typeof child === "function") {
    reactiveChildContent(parent, child, () => child())
  } else if (isReadonlySignal(child)) {
    reactiveChildContent(parent, child, () => child.value)
  } else if (child instanceof Node) {
    parent.appendChild(child)
  } else if (child !== null && child !== undefined) {
    parent.appendChild(document.createTextNode(String(child)))
  }
}

function reactiveChildContent(parent: Node, child: any, worker: () => any) {
  // Create boundary markers
  let start = document.createComment("start")
  let end = document.createComment("end")
  parent.appendChild(start)
  parent.appendChild(end)

  effect(() => {
    const value = worker()

    // Remove old content
    const range = document.createRange()
    range.setStartAfter(start)
    range.setEndBefore(end)
    range.deleteContents()

    // Prepare new nodes
    let nodes: Node[]
    if (value instanceof Node) {
      nodes = [value]
    } else if (Array.isArray(value)) {
      nodes = []
      value.forEach((v) => {
        const fragment = document.createDocumentFragment()
        appendChild(fragment, v)
        nodes.push(...Array.from(fragment.childNodes))
      })
    } else if (value !== null && value !== undefined) {
      nodes = [document.createTextNode(String(value))]
    } else {
      nodes = []
    }

    // Insert new content
    nodes.forEach((node) => {
      end.parentNode!.insertBefore(node, end)
    })
  })
}

// Component creation with context and cleanup management
export function createComponent(
  component: ComponentFunction,
  props: any,
  children: any[]
): Node {
  const contextMap = new Map()
  contextStack.push(contextMap)
  const cleanupFns: (() => void)[] = []
  cleanupStack.push(cleanupFns)

  const result = component(props, children)

  let el: Node

  if (Array.isArray(result)) {
    const fragment = document.createDocumentFragment()
    result.forEach((node) => {
      appendChild(fragment, node)
    })
    el = fragment
  } else if (result instanceof Node) {
    el = result
  } else if (result !== null && result !== undefined) {
    el = document.createTextNode(String(result))
  } else {
    el = document.createComment("")
  }

  // Since we might have multiple nodes, we use a placeholder comment to track them
  const placeholder = document.createComment("")

  // We'll wrap everything in a fragment including the placeholder
  const wrapper = document.createDocumentFragment()
  wrapper.appendChild(placeholder)
  wrapper.appendChild(el)

  // Remove context and cleanup functions when the component is unmounted
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.removedNodes.forEach((removedNode) => {
        if (removedNode === placeholder) {
          observer.disconnect()
          for (const fn of cleanupFns) {
            fn()
          }
          contextStack.pop()
          cleanupStack.pop()
        }
      })
    }
  })

  queueMicrotask(() => {
    if (placeholder.parentNode) {
      observer.observe(placeholder.parentNode, { childList: true })
    }
  })

  return wrapper
}

// Render function to mount components
export function render(component: ComponentFunction, container: HTMLElement) {
  const fragment = createComponent(component, null, [])
  const nodes = Array.from(fragment.childNodes)
  container.appendChild(fragment)
  return () => {
    nodes.forEach((node) => {
      if (container.contains(node)) {
        container.removeChild(node)
      }
    })
  }
}
