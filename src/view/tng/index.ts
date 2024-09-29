import {
  effect,
  isReadonlySignal,
  ReadonlySignal,
  Signal,
} from "../../internals"
import { applyStylesToDOM } from "../css"

type Children = () => void | string | number | Signal<any>
type ComponentHooks = {
  onDispose: (callback: Function) => void
}
type DomBuilder<P = any> = (
  props: P,
  children: Children,
  api: ComponentHooks
) => void

type View<P> = {
  (props: P, children: Children): ViewOutput<P>
  (props: P): ViewOutput<P>
  (children: Children): ViewOutput<P>
  (): ViewOutput<P>
}
type ViewOutput<P = any> = Component<P>

const EMPTY_PROPS = {}
const EMPTY_CHILDREN = () => {}
export const activeRoots = new Set<Component<any>>()

export function getEnv(key: string) {
  if (Component.active) {
    return Component.active.getEnv(key)
  }
  console.warn("No active component")
  return undefined
}
export function setEnv(key: string, value: any) {
  if (Component.active) {
    Component.active.setEnv(key, value)
  } else {
    console.warn("No active component")
  }
}

export class Component<P> {
  readonly dom: DocumentFragment
  readonly parent: Component<any> | null = null
  readonly children: Set<Component<any>> = new Set()

  env?: Map<string, any>

  constructor(private _builder: DomBuilder, args: any[]) {
    this.parent = Component.active
    if (this.parent) {
      this.parent.children.add(this)
    }
    this.dom = document.createDocumentFragment()

    const [props, children] = extractPropsAndChildren<P>(args)

    Component.active = this
    const prevActiveView = Component.activeView
    Component.activeView = this.dom
    this._builder(props, children, this.hooks)
    Component.active = this.parent
    Component.activeView = prevActiveView

    if (this.parent) {
      this.parent.dom.appendChild(this.dom)
    }
  }

  getEnv<T = any>(key: string): T | undefined {
    if (!this.env) {
      return !!this.parent ? this.parent.getEnv<T>(key) : undefined
    }
    return this.env.get(key) as T
  }
  setEnv(key: string, value: any) {
    if (!this.env) {
      if (!!this.parent) {
        this.parent.setEnv(key, value)
        return
      }
      this.env = new Map()
    }
    this.env.set(key, value)
  }

  disposeCallbacks: Set<Function> | null = null

  hooks = {
    onDispose: (callback: Function) => {
      if (Component.active !== this) {
        console.warn("onDispose() called outside of component")
        return
      }
      if (!!Component.activeView && Component.activeView !== this.dom) {
        console.warn(
          "onDispose() called outside of component view, this might cause unexpected behavior."
        )
      }
      if (!this.disposeCallbacks) {
        this.disposeCallbacks = new Set()
      }
      this.disposeCallbacks.add(callback)
    },
  }

  dispose() {
    if (this.disposeCallbacks) {
      this.disposeCallbacks.forEach((callback) => callback())
      this.disposeCallbacks.clear()
    }
    this.children.forEach((child) => child.dispose())
    if (this.parent) this.parent.children.delete(this)
    console.assert(this.children.size === 0, "Children not disposed")
  }

  static active: Component<any> | null = null
  static appendToActiveComponent(child: Node) {
    if (Component.active) {
      Component.active.dom.appendChild(child)
    } else {
      console.warn("No active component")
    }
  }

  static activeView: Node | null = null
  static appendToActiveView(child: Node) {
    if (Component.activeView) {
      Component.activeView.appendChild(child)
    } else {
      // console.warn("No active view, trying component fragment")
      Component.appendToActiveComponent(child)
    }
  }
  static inNestedActiveView<T>(el: Node, fn: () => T): T {
    const prevActive = Component.activeView
    Component.activeView = el
    const result = fn()
    Component.activeView = prevActive
    return result
  }

  static create = Object.assign(
    function instantiate(builder: DomBuilder, ...args: any[]) {
      const instance = new Component(builder, args)
      return instance
    },
    {
      styles(css: string) {
        applyStylesToDOM(css)
        return this
      },
    }
  )
}

interface ComponentFactory<P> {
  (): Component<P>
  (props: P): Component<P>
  (children: Children): Component<P>
  (props: P, children: Children): Component<P>
  styles(css: string): ComponentFactory<P>
}

export function view<P>(builder: DomBuilder<P>): ComponentFactory<P> {
  return Object.assign(
    function instantiate(...args: any[]) {
      const instance = new Component(builder, args)
      return instance
    } as ComponentFactory<P>,
    {
      styles(css: string) {
        applyStylesToDOM(css)
        return this
      },
    }
  )
}

function elem(
  name: string,
  props: any = EMPTY_PROPS,
  children: Children = EMPTY_CHILDREN
) {
  const el = document.createElement(name)

  if (typeof props === "function") {
    children = props
    props = {}
  }

  for (const key in props) {
    if (key === "class" || key === "className") {
      el.className = props[key]
    } else if (key.startsWith("on")) {
      el.addEventListener(key.slice(2).toLowerCase(), props[key])
    } else if (key === "style") {
      el.style.cssText = props[key]
    } else if (key === "html") {
      el.innerHTML = props[key]
    } else if (key === "for") {
      ;(el as HTMLLabelElement).htmlFor = props[key]
    } else if (key === "value") {
      ;(el as HTMLInputElement).value = props[key]
    } else if (key === "ref") {
      // Should this happen now, or after the element is added to the DOM?
      queueMicrotask(() => props[key](el))
      // props[key](el)
    } else {
      el.setAttribute(key, props[key])
    }
  }

  Component.appendToActiveView(el)

  Component.inNestedActiveView(el, () => {
    const result = typeof children == "function" ? children() : children
    const resultType = typeof result
    if (resultType === "string" || resultType === "number") {
      el.appendChild(document.createTextNode(String(result)))
    } else if (isReadonlySignal(result)) {
      effect(() => {
        const value = result.value
        el.textContent = String(value)
      })
    } else if (resultType != "undefined") {
      console.error("Invalid children", result)
    }
  })
}

/**
 * Conditionally renders a view based on a boolean condition.
 *
 * @param condition A function that returns a boolean value (for use in a computation)
 * @param thenBuilder When the condition is true, this function is called to build the view, otherwise it is skipped/torn down.
 */
export function when(
  condition:
    | ReadonlySignal<boolean>
    | (() => boolean | ReadonlySignal<boolean>),
  thenBuilder: () => void,
  elseBuilder?: () => void
) {
  const id = Math.random().toString(36).slice(2)
  const activeComponent = Component.active
  const activeView = Component.activeView

  // Create comment markers to denote the conditional block
  const startMarker = document.createComment(`when:${id}`)
  const endMarker = document.createComment(`/when:${id}`)

  // Insert markers into the DOM
  if (activeView) {
    activeView.appendChild(startMarker)
    activeView.appendChild(endMarker)
  } else if (activeComponent) {
    activeComponent.dom.appendChild(startMarker)
    activeComponent.dom.appendChild(endMarker)
  } else {
    console.warn("when(): No active component or view to append markers")
    return
  }

  // Create a container to hold the conditionally rendered content
  let container: DocumentFragment | null = null
  let hasError = false

  effect(() => {
    let runThenBuilder: boolean | ReadonlySignal<boolean> = false
    if (isReadonlySignal(condition)) {
      runThenBuilder = condition.value
    } else {
      runThenBuilder = condition()
    }
    if (isReadonlySignal(runThenBuilder)) {
      runThenBuilder = runThenBuilder.value
    }

    if (hasError) {
      try {
        console.log("Removing between markers")
        removeBetweenMarkers(startMarker, endMarker)
        hasError = false
      } catch (error) {
        console.error("Error removing 'when' content:", error)
      }
    }

    if (runThenBuilder) {
      if (container) {
        try {
          removeBetweenMarkers(startMarker, endMarker)
          container = null
        } catch (error) {
          console.warn("Error removing 'when' content:", error)
        }
      }

      if (!container) {
        container = document.createDocumentFragment()

        try {
          const prevComponent = Component.active
          const prevView = Component.activeView
          Component.activeView = container

          thenBuilder()

          Component.activeView = prevView
          Component.active = prevComponent

          insertBetweenMarkers(container, startMarker, endMarker)
        } catch (error) {
          console.warn("Error in 'when' builder:", error)
          displayError(startMarker, endMarker, error)
          container = null
          hasError = true
        }
      }
    } else {
      if (container) {
        try {
          removeBetweenMarkers(startMarker, endMarker)
          container = null
        } catch (error) {
          console.warn("Error removing 'when' content:", error)
        }
      }

      if (!elseBuilder) return

      container = document.createDocumentFragment()

      try {
        const prevComponent = Component.active
        const prevView = Component.activeView
        Component.activeView = container

        elseBuilder()

        Component.activeView = prevView
        Component.active = prevComponent

        insertBetweenMarkers(container, startMarker, endMarker)
      } catch (error) {
        console.warn("Error in 'when' builder:", error)
        displayError(startMarker, endMarker, error)
        container = null
        hasError = true
      }
    }
  })
}

export function text(value: string) {
  Component.appendToActiveView(document.createTextNode(value))
}

export function raw(html: string) {
  Component.appendToActiveView(
    document.createRange().createContextualFragment(html)
  )
}

export const tags: { [key in keyof HTMLElementTagNameMap]: View<any> } =
  new Proxy({} as any, {
    get(target, key: any) {
      return function (props: any, children: Children) {
        return elem(String(key).toLowerCase(), props, children)
      }
    },
  })

function extractPropsAndChildren<P>(args: any[]): [P, Children] {
  if (args.length === 0) {
    return [EMPTY_PROPS as P, EMPTY_CHILDREN]
  } else if (typeof args[0] === "function") {
    return [EMPTY_PROPS as P, args[0]]
  } else {
    return [args[0], args[1] || EMPTY_CHILDREN]
  }
}

export function designer() {}

export function render(component: Component<any>, target: HTMLElement) {
  const startMarker = document.createComment("pulse")
  const endMarker = document.createComment("/pulse")

  activeRoots.add(component)

  target.appendChild(startMarker)
  const source = component.dom
  if (Array.isArray(source)) {
    source.forEach((el) => target.appendChild(el))
  } else {
    target.appendChild(source)
  }
  target.appendChild(endMarker)

  let isDisposed = false
  return () => {
    if (isDisposed) return
    component.dispose()
    removeBetweenMarkers(startMarker, endMarker)
    target.removeChild(startMarker)
    target.removeChild(endMarker)
    activeRoots.delete(component)
    isDisposed = true
  }
}

function insertBetweenMarkers(node: Node, start: Comment, end: Comment) {
  if (end.parentNode) {
    end.parentNode.insertBefore(node, end)
  }
}

function removeBetweenMarkers(start: Comment, end: Comment) {
  const range = document.createRange()
  range.setStartAfter(start)
  range.setEndBefore(end)
  range.deleteContents()
}

function displayError(startMarker: Comment, endMarker: Comment, error: any) {
  const errorMessage = document.createElement("div")
  Object.assign(errorMessage.style, {
    color: "white",
    border: "0.1rem solid crimson",
    padding: ".25rem .5rem",
    margin: "0.25rem 0",
    background: "maroon",
    borderRadius: ".25rem",
    fontSize: ".75rem",
  })
  errorMessage.textContent = `Error: ${
    error instanceof Error ? error.message : String(error)
  }`

  insertBetweenMarkers(errorMessage, startMarker, endMarker)
}
