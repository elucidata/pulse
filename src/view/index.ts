import {
  config,
  effect,
  isReadonlySignal,
  ReadonlySignal,
  Signal,
  untracked,
} from "../internals"
import { applyStylesToDOM } from "./css"

export * from "../internals"

interface ViewFactory<P> {
  (): View<P>
  (props: P): View<P>
  (children: Children): View<P>
  (props: P, children: Children): View<P>
  styles(css: string): ViewFactory<P>
}
type Children = () => void | string | number | Signal<any>
type ViewHooks = {
  onDispose: (callback: Function) => void
}
type ViewOutput<P = any> = View<P>
type DomBuilder<P = any> = (
  props: P,
  children: Children,
  api: ViewHooks
) => void

type ElementBuilder<P> = {
  (props: P, children: Children): ViewOutput<P>
  (props: P): ViewOutput<P>
  (children: Children): ViewOutput<P>
  (): ViewOutput<P>
}

const EMPTY_PROPS = {}
const EMPTY_CHILDREN: Children = () => {}

export const activeRoots = new Set<View<any>>()

/**
 * Creates a new view factory.
 *
 * @example
 *
 * ```ts
 * const MyView = view(() => {
 *    div("Hello, world!")
 * })
 * ```
 *
 * @param builder
 * @returns
 */
export function view<P>(builder: DomBuilder<P>): ViewFactory<P> {
  return Object.assign(
    function instantiate(...args: any[]) {
      const instance = new View(builder, args)
      return instance
    } as ViewFactory<P>,
    {
      styles(css: string) {
        applyStylesToDOM(css)
        return this
      },
    }
  )
}

export class View<P> {
  readonly dom: DocumentFragment
  readonly parent: View<any> | null = null
  readonly children: Set<View<any>> = new Set()

  env?: Map<string, any>

  constructor(private _builder: DomBuilder, args: any[]) {
    this.parent = View.active
    if (this.parent) {
      this.parent.children.add(this)
    }
    this.dom = document.createDocumentFragment()

    const [props, children] = extractPropsAndChildren<P>(args)

    View.active = this
    const prevActiveView = View.activeElement
    View.activeElement = this.dom
    this._builder(props, children, this.hooks)
    View.active = this.parent
    View.activeElement = prevActiveView

    if (View.activeElement) {
      View.activeElement.appendChild(this.dom)
    } else if (this.parent) {
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
      if (View.active !== this) {
        config.verbose &&
          console.warn("onDispose() called outside of component")
        return
      }
      if (!this.disposeCallbacks) {
        this.disposeCallbacks = new Set()
      }
      this.disposeCallbacks.add(callback)
    },
  }

  dispose() {
    this.children.forEach((child) => child.dispose())
    this.children.clear()
    if (this.disposeCallbacks) {
      this.disposeCallbacks.forEach((callback) => callback())
      this.disposeCallbacks.clear()
    }
    if (this.parent) {
      this.parent.children.delete(this)
    }
  }

  static active: View<any> | null = null
  static appendToActiveView(child: Node) {
    if (View.active) {
      View.active.dom.appendChild(child)
    } else {
      config.verbose && console.warn("No active component")
    }
  }

  static activeElement: Node | null = null
  static appendToActiveElement(child: Node) {
    if (View.activeElement) {
      View.activeElement.appendChild(child)
    } else {
      View.appendToActiveView(child)
    }
  }
  static appendToActiveElements(...children: Node[]) {
    if (View.activeElement) {
      children.forEach((child) => View.activeElement!.appendChild(child))
    } else {
      children.forEach((child) => View.appendToActiveView(child))
    }
  }
  static inNestedElement<T>(el: Node, fn: () => T): T {
    const prevActive = View.activeElement
    View.activeElement = el
    const result = fn()
    View.activeElement = prevActive
    return result
  }

  static create = Object.assign(
    function instantiate(builder: DomBuilder, ...args: any[]) {
      const instance = new View(builder, args)
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

/**
 * Gets the value of an environment variable.
 *
 * @param key
 * @returns The value of the environment variable or `undefined` if it doesn't exist.
 */
export function getEnv(key: string) {
  if (View.active) {
    return View.active.getEnv(key)
  }
  config.verbose && console.warn("No active view")
  return undefined
}

/**
 * Sets the value of an environment variable.
 *
 * @param key
 * @param value
 */
export function setEnv(key: string, value: any) {
  if (View.active) {
    View.active.setEnv(key, value)
  } else {
    config.verbose && console.warn("No active component")
  }
}

/**
 * Registers a callback to be called when the active component is disposed.
 * @param callback
 */
export function onDispose(callback: Function) {
  if (View.active) {
    View.active.hooks.onDispose(callback)
  } else {
    config.verbose && console.warn("No active component")
  }
}

/**
 * Conditionally renders a view based on a boolean condition.
 *
 * @param condition A function that returns a boolean value (for use in a computation)
 * @param thenBuilder When the condition is true, this function is called to build the view, otherwise it is skipped/torn down.
 * @param elseBuilder (optional) When the condition is false, this function is called to build the view, otherwise it is skipped/torn down.
 */
export function when(
  condition:
    | ReadonlySignal<boolean>
    | boolean
    | (() => boolean | ReadonlySignal<boolean>),
  thenBuilder: () => void,
  elseBuilder?: () => void
) {
  const id = Math.random().toString(36).slice(2)
  const activeView = View.active
  const activeElement = View.activeElement

  // Create comment markers to denote the conditional block
  const startMarker = document.createComment(`when:${id}`)
  const endMarker = document.createComment(`/when:${id}`)
  if (activeElement) {
    activeElement.appendChild(startMarker)
    activeElement.appendChild(endMarker)
  } else if (activeView) {
    activeView.dom.appendChild(startMarker)
    activeView.dom.appendChild(endMarker)
  } else {
    config.verbose &&
      console.warn("when(): No active component or view to append markers")
    return
  }

  // Create a container to hold the conditionally rendered content
  let container: DocumentFragment | null = null
  let hasError = false
  let boundary: View<any>

  const withinBoundary = <T>(
    container: DocumentFragment | null,
    fn: () => T
  ) => {
    if (!!boundary) boundary.dispose()
    const prevView = View.active
    const prevElement = View.activeElement
    View.active = activeView
    View.activeElement = container //activeView
    boundary = View.create(() => {}, [])
    View.active = boundary
    const result = fn()
    View.active = prevView
    View.activeElement = prevElement
    return result
  }

  effect(
    () => {
      // try {
      let runThenBuilder: boolean | ReadonlySignal<boolean> = false
      if (isReadonlySignal(condition)) {
        runThenBuilder = condition.value
      } else if (typeof condition === "boolean") {
        runThenBuilder = condition
      } else {
        runThenBuilder = condition()
      }
      if (isReadonlySignal(runThenBuilder)) {
        runThenBuilder = runThenBuilder.value
      }

      if (hasError) {
        try {
          removeBetweenMarkers(startMarker, endMarker)
          hasError = false
        } catch (error) {
          config.verbose &&
            console.error("Error removing 'when' error content:", error)
        }
      }

      if (container) {
        try {
          removeBetweenMarkers(startMarker, endMarker)
          container = null
        } catch (error) {
          config.verbose &&
            console.warn("Error removing 'when' content:", error)
        }
      }

      container = document.createDocumentFragment()
      const prevActive = View.active
      const prevView = View.activeElement

      try {
        View.activeElement = container
        View.active = null // or set to an appropriate value if needed

        untracked(() => {
          withinBoundary(container, () => {
            if (runThenBuilder) {
              thenBuilder()
            } else if (elseBuilder) {
              elseBuilder()
            }
          })
        })

        insertBetweenMarkers(container, startMarker, endMarker)
      } catch (error) {
        config.verbose && console.warn("Error in 'when' builder:", error)
        removeBetweenMarkers(startMarker, endMarker)
        displayError(startMarker, endMarker, error)
        container = null
        hasError = true
      } finally {
        View.activeElement = prevView
        View.active = prevActive
      }
    },
    (err) => {
      config.verbose && console.error("💥 Error in 'when' effect:", err)
      removeBetweenMarkers(startMarker, endMarker)
      displayError(startMarker, endMarker, err)
      hasError = true
    }
  )
}

/**
 * Works kind of like `when`, but the whole block is evaluated and
 * re-rendered when any observed signals change.
 *
 * @param builder The function that builds the view
 * @returns void
 */
export function live(builder: () => void) {
  const id = Math.random().toString(36).slice(2)
  const activeView = View.active
  const activeElement = View.activeElement

  // Create comment markers to denote the conditional block
  const startMarker = document.createComment(`live:${id}`)
  const endMarker = document.createComment(`/live:${id}`)

  // Insert markers into the DOM
  if (activeElement) {
    activeElement.appendChild(startMarker)
    activeElement.appendChild(endMarker)
  } else if (activeView) {
    activeView.dom.appendChild(startMarker)
    activeView.dom.appendChild(endMarker)
  } else {
    config.verbose &&
      console.warn("live(): No active component or view to append markers")
    return
  }

  // Create a container to hold the conditionally rendered content
  let container: DocumentFragment | null = null
  let hasError = false
  let boundary = new View(() => {}, [])

  effect(() => {
    if (hasError) {
      try {
        removeBetweenMarkers(startMarker, endMarker)
        hasError = false
      } catch (error) {
        config.verbose && console.error("Error removing 'live' content:", error)
      }
    }

    if (container) {
      try {
        removeBetweenMarkers(startMarker, endMarker)
        container = null
      } catch (error) {
        config.verbose && console.warn("Error removing 'live' content:", error)
      }
    }

    if (!!boundary) {
      boundary.dispose()
      const prevComponent = View.active
      const prevView = View.activeElement
      View.active = activeView
      View.activeElement = activeElement
      boundary = new View(() => {}, [])
      View.active = prevComponent
      View.activeElement = prevView
    }

    container = document.createDocumentFragment()

    try {
      const prevComponent = View.active
      const prevView = View.activeElement
      View.activeElement = container
      // Component.active = null
      View.active = boundary

      builder()

      View.activeElement = prevView
      View.active = prevComponent

      insertBetweenMarkers(container, startMarker, endMarker)
    } catch (error) {
      config.verbose && console.warn("Error in 'live' builder:", error)
      displayError(startMarker, endMarker, error)
      // container = null
      hasError = true
    }
  })
}

function renderMarkers(id: string) {
  const startMarker = document.createComment(id)
  const endMarker = document.createComment(`/${id}`)
  return { startMarker, endMarker }
}

/**
 * Renders an value as text.
 * @param value The value to display
 */
export function text(value: string | number | ReadonlySignal<any>) {
  if (isReadonlySignal(value)) {
    const id = Math.random().toString(36).slice(2)
    const { startMarker, endMarker } = renderMarkers(`text:${id}`)

    View.appendToActiveElements(startMarker, endMarker)
    const disposeLiveText = effect(() => {
      const textValue = value.value
      removeBetweenMarkers(startMarker, endMarker)
      insertBetweenMarkers(
        document.createTextNode(String(textValue)),
        startMarker,
        endMarker
      )
      // textNode.replaceWith(document.createTextNode(String(textValue)))
      // textNode.textContent = String(textValue)
      // View.appendToActiveElement(document.createTextNode(String(textValue)))
    })
    View.active?.hooks.onDispose(() => {
      disposeLiveText()
      removeBetweenMarkers(startMarker, endMarker)
    })
    return
  }
  View.appendToActiveElement(document.createTextNode(String(value)))
}

export function raw(html: string) {
  View.appendToActiveElement(
    document.createRange().createContextualFragment(html)
  )
}

type KeyedView<T> = {
  key: any
  view: View<any>
}

/**
 * Iterates over an array or signal containing an array, rendering views for each item.
 *
 * @param list - An array or signal containing an array of items.
 * @param itemBuilder - A function that receives each item and index, and builds the view.
 * @param options - Optional configuration, including a key extractor function.
 */
export function each<T>(
  list: T[] | ReadonlySignal<T[]>,
  itemBuilder: (item: T, index: number) => void,
  keyExtractor?: (item: T, index: number) => any
) {
  const id = Math.random().toString(36).slice(2)
  const parentView = View.active
  const parentElement = View.activeElement

  // Create comment markers to denote the each block
  const startMarker = document.createComment(`each:${id}`)
  const endMarker = document.createComment(`/each:${id}`)

  // Insert markers into the DOM
  if (parentElement) {
    parentElement.appendChild(startMarker)
    parentElement.appendChild(endMarker)
  } else if (parentView) {
    parentView.dom.appendChild(startMarker)
    parentView.dom.appendChild(endMarker)
  } else {
    config.verbose &&
      console.warn("each(): No active component or view to append markers")
    return
  }

  let keyedViews = new Map<any, KeyedView<T>>()
  let hasError = false
  let hasWarnedAboutKeyExtractor = false
  let boundary = new View(() => {}, [])

  const disposeEffect = effect(
    () => {
      if (hasError) {
        try {
          removeBetweenMarkers(startMarker, endMarker)
          hasError = false
        } catch (error) {
          config.verbose &&
            console.error("Error removing 'each' error content:", error)
        }
      }

      // Get the current list value
      let currentList: T[]
      if (isReadonlySignal(list)) {
        currentList = list.value
      } else {
        currentList = list
      }
      if (!Array.isArray(currentList)) {
        config.verbose &&
          console.error("each(): Provided list is not an array", currentList)
        currentList = []
      }

      // Prepare new map of keyed views
      const newKeyedViews = new Map<any, KeyedView<T>>()
      const fragment = document.createDocumentFragment()

      // Generate views for each item
      currentList.forEach((item, index) => {
        // Generate a key for the item
        let key: any = index // Default key is the index
        if (typeof keyExtractor === "function") {
          key = keyExtractor(item, index)
          if (!key) {
            key = index
            config.verbose && console.warn("Key extractor returned falsy value")
          }
        } else if ((item as any).id !== undefined) {
          key = (item as any).id
        } else if (typeof item === "string" || typeof item === "number") {
          key = index + ":" + item
        }

        if (config.verbose && key === index && !hasWarnedAboutKeyExtractor) {
          console.warn(
            "Using index as key for each item. Consider providing a keyExtractor function."
          )
          hasWarnedAboutKeyExtractor = true
        }

        let keyedView = keyedViews.get(key)

        if (!keyedView) {
          // Save current active view and element
          const prevActiveView = View.active
          const prevActiveElement = View.activeElement

          // Set active view and element to the each container
          View.active = boundary
          View.activeElement = boundary.dom

          try {
            const subview = new View(() => {}, [])

            // Build the view for the item
            View.active = subview
            View.activeElement = subview.dom
            itemBuilder(item, index)

            keyedView = { key, view: subview }
          } finally {
            // Restore previous active view and element
            View.active = prevActiveView
            View.activeElement = prevActiveElement
          }
        } // else a view already exists for this key, no need to rebuild

        newKeyedViews.set(key, keyedView)
        const clone = keyedView.view.dom.cloneNode(true)
        fragment.appendChild(clone)
      })

      // Remove views that are no longer needed
      keyedViews.forEach((keyedView, key) => {
        if (!newKeyedViews.has(key)) {
          keyedView.view.dispose()
        }
      })

      keyedViews = newKeyedViews

      // Insert the generated content into the DOM
      removeBetweenMarkers(startMarker, endMarker)
      insertBetweenMarkers(fragment, startMarker, endMarker)
    },
    (error) => {
      config.verbose && console.error("Error in 'each' effect:", error)
      removeBetweenMarkers(startMarker, endMarker)
      displayError(startMarker, endMarker, error)
      hasError = true
    }
  )

  // Cleanup when the parent view is disposed
  if (parentView) {
    parentView.hooks.onDispose(() => {
      disposeEffect()
      keyedViews.forEach((keyedView) => {
        keyedView.view.dispose()
      })
      keyedViews.clear()
    })
  }
}

/**
 * Creates a new element with the given tag name.
 * @usage
 * ```ts
 * const { a, div, button } = tags
 *
 * // elsewhere...
 * const MyView = view(() => { div("Hello") })
 * ```
 */
export const tags: {
  [key in keyof HTMLElementTagNameMap]: ElementBuilder<any>
} = new Proxy({} as any, {
  get(target, key: any) {
    return function (props: any, children: Children) {
      return element(String(key).toLowerCase(), props, children)
    }
  },
})

/**
 * Renders a view instance into a target element.
 *
 * @param viewInstance  The view instance to render
 * @param target The target element to render the view into
 * @returns A function that can be called to dispose of the view
 */
export function render(viewInstance: View<any>, target: HTMLElement) {
  const startMarker = document.createComment("pulse")
  const endMarker = document.createComment("/pulse")

  activeRoots.add(viewInstance)

  target.appendChild(startMarker)
  const source = viewInstance.dom
  if (Array.isArray(source)) {
    source.forEach((el) => target.appendChild(el))
  } else {
    target.appendChild(source)
  }
  target.appendChild(endMarker)

  let isDisposed = false
  return () => {
    if (isDisposed) return
    viewInstance.dispose()
    removeBetweenMarkers(startMarker, endMarker)
    target.removeChild(startMarker)
    target.removeChild(endMarker)
    activeRoots.delete(viewInstance)
    isDisposed = true
  }
}

function element(
  name: string,
  props: any = EMPTY_PROPS,
  children: Children = EMPTY_CHILDREN
) {
  const el = document.createElement(name)

  if (typeof props === "function") {
    children = props
    props = {}
  }

  if (
    typeof props === "string" ||
    typeof props === "number" ||
    isReadonlySignal(props)
  ) {
    children = props as any
    props = {}
  }

  for (const key in props) {
    if (key === "class" || key === "className") {
      setElProp(el, "className", props[key])
    } else if (key.startsWith("on")) {
      el.addEventListener(key.slice(2).toLowerCase(), props[key])
    } else if (key === "style") {
      el.style.cssText = props[key]
    } else if (key === "html") {
      setElProp(el, "innerHTML", props[key])
    } else if (key === "for") {
      setElProp(el, "htmlFor", props[key])
    } else if (key === "ref") {
      // Should this happen now, or after the element is added to the DOM?
      queueMicrotask(() => props[key](el))
    } else if (key === "key") {
      // probably not needed?
      setElAttr(el, "data-key", props[key])
    } else if (key === "data") {
      for (const dataKey in props[key]) {
        el.dataset[dataKey] = props[key][dataKey]
      }
    } else if (key === "use") {
      queueMicrotask(() => props[key](el))
    } else {
      setElAttr(el, key, props[key])
    }
  }

  View.appendToActiveElement(el)

  View.inNestedElement(el, () => {
    const result = typeof children == "function" ? children() : children
    const resultType = typeof result
    if (resultType === "string" || resultType === "number") {
      el.appendChild(document.createTextNode(String(result)))
    } else if (isReadonlySignal(result)) {
      const disposeLiveChildren = effect(() => {
        const value = result.value
        el.textContent = String(value)
      })
      View.active?.hooks.onDispose(disposeLiveChildren)
    } else if (resultType != "undefined") {
      config.verbose && console.error("Invalid children", result)
    }
  })
}

function setElAttr(el: Element, key: string, value: any) {
  if (isReadonlySignal(value)) {
    const disposeLiveAttr = effect(() => {
      el.setAttribute(key, String(value.value))
    })
    View.active?.hooks.onDispose(disposeLiveAttr)
  } else {
    el.setAttribute(key, String(value))
  }
}
function setElProp(el: Element, key: string, value: any) {
  if (isReadonlySignal(value)) {
    const disposeLiveAttr = effect(() => {
      ;(el as any)[key] = value.value
    })
    View.active?.hooks.onDispose(disposeLiveAttr)
  } else {
    ;(el as any)[key] = value
  }
}

function extractPropsAndChildren<P>(args: any[]): [P, Children] {
  if (args.length === 0) {
    return [EMPTY_PROPS as P, EMPTY_CHILDREN]
  } else if (typeof args[0] === "function") {
    return [EMPTY_PROPS as P, args[0]]
  } else {
    return [args[0], args[1] || EMPTY_CHILDREN]
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
  errorMessage.textContent = `[Pulse Error]: ${
    error instanceof Error ? error.message : String(error)
  }`

  insertBetweenMarkers(errorMessage, startMarker, endMarker)
}
