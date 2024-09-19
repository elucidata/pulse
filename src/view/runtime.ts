// Import Pulse functions
import { effect } from "../internals"
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

export function onMount(fn: () => void) {
  if (cleanupStack.length === 0) {
    throw new Error("onMount must be called within a component")
  }
  queueMicrotask(fn)
}

export function onUnmount(fn: () => void) {
  if (cleanupStack.length === 0) {
    throw new Error("onUnmount must be called within a component")
  }
  cleanupStack[cleanupStack.length - 1]?.push(fn)
}

// JSX-compatible createElement function
export function h(
  tag: string | ComponentFunction,
  props: PropsWithChildren | null,
  ...children: any[]
): HTMLElement {
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

// Helper function to append children to a parent node
export function appendChild(parent: Node, child: any): void {
  if (Array.isArray(child)) {
    child.forEach((c) => appendChild(parent, c))
  } else if (typeof child === "function") {
    let node = document.createComment("")
    parent.appendChild(node)
    effect(() => {
      const value = child()
      let newNode: Node
      if (value instanceof Node) {
        newNode = value
      } else {
        newNode = document.createTextNode(String(value))
      }
      if (node.parentNode) {
        node.parentNode.replaceChild(newNode, node)
      }
      //@ts-ignore: Getting around TypeScript's strictness?
      node = newNode
    })
  } else if (child instanceof Node) {
    parent.appendChild(child)
  } else if (child !== null && child !== undefined) {
    parent.appendChild(document.createTextNode(String(child)))
  }
}

// Component creation with context and cleanup management
export function createComponent(
  component: ComponentFunction,
  props: any,
  children: any[]
): HTMLElement {
  const contextMap = new Map()
  contextStack.push(contextMap)
  const cleanupFns: (() => void)[] = []
  cleanupStack.push(cleanupFns)

  const el = component(props, children)

  // Remove context and cleanup functions when the component is unmounted
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (Array.from(mutation.removedNodes).includes(el)) {
        observer.disconnect()
        for (const fn of cleanupFns) {
          fn()
        }
        contextStack.pop()
        cleanupStack.pop()
        break
      }
    }
  })

  observer.observe(el.parentNode || document, { childList: true })

  return el
}

// Render function to mount components
export function render(component: ComponentFunction, container: HTMLElement) {
  const el = createComponent(component, null, [])
  container.appendChild(el)
  return () => {
    container.removeChild(el)
  }
}
