import {
  effect as baseEffect,
  EffectFunction,
  isReadonlySignal,
} from "../internals"
import { ComponentFunction, Props } from "./types"

export function effect(fn: EffectFunction): void {
  const dispose = baseEffect(fn)
  if (currentCleanupFns) {
    currentCleanupFns.push(dispose)
  }
}

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

export const cleanupStack: (() => void)[][] = []
let currentCleanupFns: (() => void)[] | undefined

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
export function h(
  tag: string | ComponentFunction,
  props: Props | null,
  ...children: any[]
): Node {
  if (typeof tag === "function") {
    // Component function
    const { node } = createComponent(tag, props, children)
    return node
  }

  const el = document.createElement(tag)

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key === "children") {
        continue
      } else if (key == "className" || key == "class") {
        el.className = value as string
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
        el.setAttribute(key, value as any)
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

function reactiveAttributeEffect(
  el: HTMLElement,
  key: string,
  worker: () => any
) {
  effect(() => {
    const newValue = worker()
    if (newValue === false || newValue == null) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, String(newValue))
    }

    // Return a cleanup function to remove the attribute on disposal
    return () => {
      el.removeAttribute(key)
    }
  })
}

// Helper function to append children to a parent node
export function appendChild(
  parent: Node,
  child: any,
  disposes?: (() => void)[]
): void {
  if (Array.isArray(child)) {
    child.forEach((c) => appendChild(parent, c, disposes))
  } else if (typeof child === "function") {
    reactiveChildContent(parent, () => child())
  } else if (isReadonlySignal(child)) {
    reactiveChildContent(parent, () => child.value)
  } else if (
    child &&
    typeof child === "object" &&
    "node" in child &&
    "dispose" in child
  ) {
    // Child is a component object
    parent.appendChild(child.node)
    if (currentCleanupFns) {
      currentCleanupFns.push(child.dispose)
    }
  } else if (child instanceof Node) {
    parent.appendChild(child)
  } else if (child !== null && child !== undefined) {
    parent.appendChild(document.createTextNode(String(child)))
  }
}

function reactiveChildContent(parent: Node, worker: () => any) {
  // Boundary markers
  let start = document.createComment("")
  let end = document.createComment("/")
  parent.appendChild(start)
  parent.appendChild(end)

  effect(() => {
    const cleanupFns: (() => void)[] = []
    cleanupStack.push(cleanupFns)

    const value = worker()

    let disposes: (() => void)[] = []

    const fragment = document.createDocumentFragment()
    appendChild(fragment, value, disposes)

    end.parentNode!.insertBefore(fragment, end)

    // Return a cleanup function to remove inserted nodes and dispose components on disposal
    return () => {
      const range = document.createRange()
      range.setStartAfter(start)
      range.setEndBefore(end)
      range.deleteContents()

      disposes.forEach((dispose) => dispose())
      for (const fn of cleanupFns) {
        fn()
      }
      cleanupStack.pop()
    }
  })
}

export function createComponent(
  component: ComponentFunction,
  props: any,
  children: any[]
): { node: Node; dispose: () => void } {
  const contextMap = new Map()
  contextStack.push(contextMap)

  const cleanupFns: (() => void)[] = []

  const prevCleanupFns = currentCleanupFns
  currentCleanupFns = cleanupFns

  cleanupStack.push(cleanupFns)

  const result = component(props, children)
  const fragment = document.createDocumentFragment()

  if (Array.isArray(result)) {
    result.forEach((node) => {
      appendChild(fragment, node)
    })
  } else {
    appendChild(fragment, result)
  }

  let isDisposed = false
  const dispose = () => {
    if (isDisposed) {
      return console.warn("Component already unmounted")
    }

    for (const fn of cleanupFns) {
      fn()
    }

    contextStack.pop()
    cleanupStack.pop()
    isDisposed = true
  }

  currentCleanupFns = prevCleanupFns

  if (currentCleanupFns) {
    currentCleanupFns.push(dispose)
  }

  return { node: fragment, dispose }
}

/**
 * Renders a component into a specified container element.
 *
 * @param component - The component function to render.
 * @param container - The HTML element to render the component into.
 * @returns A function that, when called, will unmount the rendered component and clean up resources.
 *
 * @remarks
 * The function creates a component using `createComponent`, and appends it to the container
 * between two comment nodes (`pulse` and `/pulse`). The returned function can be used to
 * unmount the component, remove the comment nodes, and clean up resources.
 *
 * @example
 * ```typescript
 * const unmount = render(MyComponent, document.getElementById('app'));
 * // To unmount the component later:
 * unmount();
 * ```
 */
export function render(component: ComponentFunction, container: HTMLElement) {
  const { node, dispose } = createComponent(component, null, [])
  const startMarker = document.createComment("pulse")
  const endMarker = document.createComment("/pulse")

  container.appendChild(startMarker)
  container.appendChild(node)
  container.appendChild(endMarker)

  let isDisposed = false

  return () => {
    if (isDisposed) {
      return console.warn("Render root already unmounted")
    }
    dispose()
    const range = document.createRange()
    range.setStartAfter(startMarker)
    range.setEndBefore(endMarker)
    range.deleteContents()
    container.removeChild(startMarker)
    container.removeChild(endMarker)
    isDisposed = true
  }
}
