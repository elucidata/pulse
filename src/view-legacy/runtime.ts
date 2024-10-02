import { effect as baseEffect, EffectFunction, isSignal } from "../internals"
import { ComponentFunction, Props } from "./types"

/*

Known Issues:
- The lifecycle methods are not working as expected. 
  - The cleanup functions are not being called when the component is unmounted. (or maybe there queue until the rende root is unmounted -- haven't tracked it down yet)
*/

// Module-level variable to track the current RenderRoot
let currentRenderRoot: RenderRoot | null = null

// RenderRoot class encapsulating per-rendering state
class RenderRoot {
  contextStack: Map<any, any>[] = []
  cleanupStack: (() => void)[][] = []
  currentCleanupFns: (() => void)[] | undefined
  // Keep track of the current ComponentInstance
  currentInstance: ComponentInstance | null = null
}

// Updated effect function
export function effect(fn: EffectFunction): void {
  const root = currentRenderRoot
  if (!root) {
    throw new Error("effect must be called within a render context")
  }
  const dispose = baseEffect(fn)
  if (root.currentCleanupFns) {
    root.currentCleanupFns.push(dispose)
  }
}

// Updated context functions
export function setContext(key: any, value: any) {
  const root = currentRenderRoot
  if (!root) {
    throw new Error("setContext must be called within a render context")
  }
  if (root.contextStack.length === 0) {
    throw new Error("setContext must be called within a component")
  }
  root.contextStack[root.contextStack.length - 1]?.set(key, value)
}

export function getContext<T>(key: any): T {
  const root = currentRenderRoot
  if (!root) {
    throw new Error("getContext must be called within a render context")
  }
  for (let i = root.contextStack.length - 1; i >= 0; i--) {
    if (root.contextStack[i]?.has(key)) {
      return root.contextStack[i]?.get(key)
    }
  }
  throw new Error("Context not found for key")
}

// Updated cleanup functions
export function onMount(fn: () => void | (() => void)) {
  const root = currentRenderRoot
  if (!root) {
    throw new Error("onMount must be called within a render context")
  }
  if (root.cleanupStack.length === 0) {
    throw new Error("onMount must be called within a component")
  }
  queueMicrotask(() => {
    const unmount = fn()
    if (unmount) {
      onUnmount(unmount, root)
    }
  })
}

/** @deprecated Use return value of onMount for clean up functions */
export function onUnmount(fn: () => void, activeRoot?: RenderRoot) {
  const root = activeRoot || currentRenderRoot
  if (!root) {
    throw new Error("onUnmount must be called within a render context")
  }
  if (root.cleanupStack.length === 0) {
    throw new Error("onUnmount must be called within a component")
  }
  root.cleanupStack[root.cleanupStack.length - 1]?.push(fn)
}

// Updated h function without changing its signature
export function h(
  tag: string | ComponentFunction,
  props: Props | null,
  ...children: any[]
): Node {
  const root = currentRenderRoot
  if (!root) {
    throw new Error("h must be called within a render context")
  }

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
      } else if (isSignal(value)) {
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

// Updated appendChild function
export function appendChild(
  parent: Node,
  child: any,
  activeRoot?: RenderRoot
): void {
  const root = activeRoot || currentRenderRoot
  if (!root) {
    throw new Error("appendChild must be called within a render context")
  }

  if (Array.isArray(child)) {
    child.forEach((c) => appendChild(parent, c))
  } else if (typeof child === "function") {
    reactiveChildContent(parent, () => child())
  } else if (isSignal(child)) {
    reactiveChildContent(parent, () => child.value)
  } else if (
    child &&
    typeof child === "object" &&
    "node" in child &&
    "dispose" in child
  ) {
    // Child is a component object
    parent.appendChild(child.node)
    if (root.currentCleanupFns) {
      root.currentCleanupFns.push(child.dispose)
    }
  } else if (child instanceof Node) {
    parent.appendChild(child)
  } else if (child !== null && child !== undefined) {
    parent.appendChild(document.createTextNode(String(child)))
  }
}

function inCurrentRenderRoot<T>(fn: () => T, activeRoot?: RenderRoot): T {
  const root = activeRoot || currentRenderRoot
  if (!root) {
    throw new Error("Function must be called within a render context")
  }
  const prevRoot = currentRenderRoot
  currentRenderRoot = root
  try {
    const result = fn()
    return result
  } finally {
    currentRenderRoot = prevRoot
  }
}

function reactiveChildContent(parent: Node, worker: () => any) {
  const root = currentRenderRoot
  if (!root) {
    throw new Error(
      "reactiveChildContent must be called within a render context"
    )
  }

  // Boundary markers
  let start = document.createComment("")
  let end = document.createComment("/")
  parent.appendChild(start)
  parent.appendChild(end)

  effect(() => {
    const cleanupFns: (() => void)[] = []
    root.cleanupStack.push(cleanupFns)

    const value = inCurrentRenderRoot(() => worker(), root)

    let disposes: (() => void)[] = []

    const fragment = document.createDocumentFragment()
    appendChild(fragment, value, root)

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
      root.cleanupStack.pop()
    }
  })
}

type Disposer = () => void
class ComponentInstance {
  progenitor: ComponentFunction
  parent: ComponentInstance | null = null
  children: ComponentInstance[] = []
  node: Node

  protected contextMap?: Map<any, any>
  protected disposeFns?: Set<Disposer>

  // Reference to the RenderRoot
  root: RenderRoot

  constructor(parent: ComponentInstance | null) {
    const root = currentRenderRoot
    if (!root) {
      throw new Error(
        "ComponentInstance must be created within a render context"
      )
    }
    this.root = root
    this.parent = parent
    parent?.children.push(this)
  }

  getContext<T>(key: any): T {
    if (!this.contextMap || !this.contextMap.has(key)) {
      if (!this.parent) {
        throw new Error("Context not found for key")
      }
      return this.parent.getContext(key)
    }
    return this.contextMap.get(key)
  }
  setContext(key: any, value: any) {
    if (!this.contextMap) {
      this.contextMap = new Map()
    }
    this.contextMap.set(key, value)
  }

  addDisposer(dispose: () => void) {
    if (!this.disposeFns) {
      this.disposeFns = new Set()
    }
    this.disposeFns.add(dispose)
  }

  dispose() {
    // clone the children array to avoid mutation during disposal
    Array.from(this.children).forEach((child) => child.dispose())
    this.disposeFns?.forEach((dispose) => dispose())
    this.disposeFns?.clear()
    this.contextMap?.clear()
    this.parent?.children.splice(this.parent.children.indexOf(this), 1)
    console.assert(
      this.children.length === 0,
      "Component still has children after disposal"
    )
  }

  static withNewChild<T>(worker: (current: ComponentInstance) => T) {
    const root = currentRenderRoot
    if (!root) {
      throw new Error("withNewChild must be called within a render context")
    }
    const prevInstance = root.currentInstance
    const newInstance = new ComponentInstance(prevInstance)
    root.currentInstance = newInstance
    const result = worker(newInstance)
    root.currentInstance = prevInstance
    return result
  }
}

export function createComponent(
  component: ComponentFunction,
  props: any,
  children: any[]
): { node: Node; dispose: () => void } {
  const root = currentRenderRoot
  if (!root) {
    throw new Error("createComponent must be called within a render context")
  }

  return ComponentInstance.withNewChild((instance) => {
    const contextMap = new Map()
    root.contextStack.push(contextMap)

    const cleanupFns: (() => void)[] = []

    const prevCleanupFns = root.currentCleanupFns
    root.currentCleanupFns = cleanupFns

    root.cleanupStack.push(cleanupFns)

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

      root.contextStack.pop()
      root.cleanupStack.pop()
      isDisposed = true
    }

    root.currentCleanupFns = prevCleanupFns

    if (root.currentCleanupFns) {
      root.currentCleanupFns.push(dispose)
    }

    return { node: fragment, dispose }
  })
}

export function render(component: ComponentFunction, container: HTMLElement) {
  const root = new RenderRoot()

  const prevRoot = currentRenderRoot
  currentRenderRoot = root

  const { node, dispose } = createComponent(component, null, [])
  const startMarker = document.createComment("pulse")
  const endMarker = document.createComment("/pulse")

  container.appendChild(startMarker)
  container.appendChild(node)
  container.appendChild(endMarker)

  currentRenderRoot = prevRoot

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
