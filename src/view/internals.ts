import {
  config,
  effect,
  isSignal,
  ISignal,
  isMutableSignal,
  Ident,
  withIdPrefix,
  signal,
  computed,
  register,
  Computation,
  IMutableSignal,
} from "../internals"
import {
  css as cssTemplate,
  applyStylesToDOM,
  withAutoScope,
  classNames,
} from "./css"

export const PulseViewFactory = Symbol("PulseViewFactory")
export const PulseView = Symbol("PulseView")

export interface ViewFactory<P> {
  [PulseViewFactory]: true
  (): View<P>
  (props: P): View<P>
  (children: Children): View<P>
  (props: P, children: Children): View<P>
  styles(css: string): ViewFactory<P>
}

export type Children = () =>
  | void
  | string
  | number
  | ISignal<string | number>
  | any // technically you can return anything, but anything not listed is ignored
export type RenderableChildren = () =>
  | void
  | string
  | number
  | ISignal<string | number>

export type ViewHooks = {
  onDispose: (callback: Function) => void
}

export type DomBuilder<P = any> = (
  props: P,
  children: Children,
  api: ViewHooks
) => void

export interface CssRecord {
  [property: string]: string | number | CssRecord | Partial<CSSStyleDeclaration>
}

export type CustomCSS = (Partial<CSSStyleDeclaration> & CssRecord) | string
export type CustomStyleCSS = Partial<CSSStyleDeclaration> | string
export type ElementBuilder<P, M, E extends HTMLElement> = {
  (props: P, children: Children): ElementModifiers<M, E>
  (props: P): ElementModifiers<M, E>
  (children: Children): ElementModifiers<M, E>
  (): ElementModifiers<M, E>

  extend(css: CustomCSS): ElementBuilder<P, M, E>
  extend<N>(modifiers: ModifierBuilder<N, E>): ElementBuilder<P, M & N, E>
  extend<N>(
    css: CustomCSS,
    modifiers: ModifierBuilder<N, E>
  ): ElementBuilder<P, M & N, E>
}

export type ModifierBuilder<N, E extends HTMLElement> = (
  modifiers: BaseModifiers<E>,
  context: ModifierBuilderContext<E>
) => N

export type ModifierBuilderContext<E = HTMLElement> = {
  element: E
  onDispose: (callback: Function) => void
  bindValue: <T>(value: ReactiveValue<T>, callback: ReactiveCallback<T>) => void
  bindEvent: <T extends keyof HTMLElementEventMap>(
    event: T,
    callback: (e: HTMLElementEventMap[T]) => void
  ) => void
}

export type BaseModifiers<E extends HTMLElement> = {
  /**
   * Adds a class name to the element.
   */
  className: (...args: any[]) => BaseModifiers<E>
  /**
   * Adds a style to the element.
   */
  css: (styles: CustomStyleCSS) => BaseModifiers<E>
  /**
   * Sets the element as `inert` (not interactive).
   */
  inert: (freeze?: ReactiveValue<boolean>) => BaseModifiers<E>
  /**
   * Adds an event listener to the element that's automatically cleaned up.
   */
  on: (
    event: keyof HTMLElementEventMap,
    callback: (e: Event | CustomEvent) => void
  ) => BaseModifiers<E>
  /**
   * Sets the element's transition name. (Used for animations)
   */
  transitionName: (name: string) => BaseModifiers<E>
  /**
   * Applies a directive to the element.
   */
  use: (
    callback: (element: E, helpers: ModifierBuilderContext<E>) => void
  ) => BaseModifiers<E>
}

export type ElementModifiers<M, E extends HTMLElement> = Chainable<
  BaseModifiers<E> & M
>

export type MaybeSignal<T> = {
  [P in keyof T]: T[P] | ISignal<T[P]>
}

export type Chainable<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => any
    ? (...args: A) => Chainable<T>
    : T[K]
}

export type ExtractProps<T> = T extends ElementBuilder<infer P, any, any>
  ? P
  : never

export const NOOP = () => {}
export const EMPTY_PROPS = {}
export const EMPTY_CHILDREN: Children = NOOP

export const _activeRoots = new Set<View<any>>()
// export const _viewRegistry = new Map<string, any>()

//@ts-ignore
globalThis._pulse_ ||= {}
//@ts-ignore
globalThis._pulse_.activeRenderRoots = _activeRoots
//@ts-ignore
// globalThis._pulse_.viewRegistry = _viewRegistry

export const registerView = (key: string, view: any) => {
  register(key, view)
  // _viewRegistry.set(key, view)
}
export const unregisterView = (key: string) => {
  // _viewRegistry.delete(key)
}

export function logVerbose(...messages: any) {
  if (config.verbose) {
    console.warn("[PulseView]", ...messages)
  }
}

/**
 * Global environment variables for all views.
 */
export const env = iife(() => {
  const _data = new Map<string, any>()
  return Object.assign(
    function env<T>(key: string): T | undefined {
      return _data.get(key) as T
    },
    {
      get _data() {
        return _data
      },
      set(key: string, value: any) {
        _data.set(key, value)
      },
      has(key: string) {
        return _data.has(key)
      },
      get<T>(key: string, defaultValue?: T): T | undefined {
        return _data.get(key) ?? defaultValue
      },
    }
  )
})

/**
 * Context variables for view hierarchies.
 */
export const context = Object.assign(
  function context<T>(key: string): T | undefined {
    if (!View.active) return logVerbose("No active view to get context") as any
    return View.active?.context.get(key)
  },
  {
    set(key: string, value: any) {
      if (!View.active) return logVerbose("No active view to set context")
      View.active?.context.set(key, value)
    },
    has(key: string) {
      if (!View.active) return logVerbose("No active view to check context")
      return View.active?.context.has(key) ?? false
    },
    get<T>(key: string, defaultValue?: T): T | undefined {
      if (!View.active)
        return logVerbose("No active view to get context"), defaultValue
      return View.active?.context.get(key) ?? defaultValue
    },
  }
)

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
  const idPrefix = Ident.prefix
  return Object.assign(
    function view(...args: any[]) {
      return withIdPrefix(idPrefix, () => {
        const instance = new View(builder, args)
        return instance
      })
    } as ViewFactory<P>,
    {
      [PulseViewFactory]: true,
      styles(css: string) {
        applyStylesToDOM(css)
        return this
      },
    }
  )
}

export class View<P> {
  [PulseView] = true
  readonly id = Ident.create("V")
  readonly dom: DocumentFragment
  readonly parent: View<any> | null = null
  readonly children: Set<View<any>> = new Set()
  readonly props: P

  protected _contextData?: Map<string, any>

  context = {
    set: (key: string, value: any) => {
      if (!this._contextData) {
        this._contextData = new Map()
      }
      this._contextData.set(key, value)
    },
    get: (key: string): any => {
      if (!this._contextData) return this.parent?.context.get(key)
      if (!this._contextData.has(key) && this.parent)
        return this.parent?.context.get(key)
      return this._contextData.get(key)
    },
    has: (key: string): boolean => {
      if (!this._contextData) return this.parent?.context.has(key) ?? false
      if (!this._contextData.has(key) && this.parent)
        return this.parent?.context.has(key)
      return false
    },
  }

  constructor(private _builder: DomBuilder, args: any[]) {
    registerView(this.id, this)
    this.parent = View.active
    if (this.parent) {
      this.parent.children.add(this)
    }
    this.dom = document.createDocumentFragment()
    const [props, children] = extractPropsAndChildren<P>(args)
    this.props = props

    try {
      View.inRenderContext(this, this.dom, () => {
        this._builder(props, children, this.hooks)
      })

      if (View.activeElement) {
        View.activeElement.appendChild(this.dom)
      } else if (this.parent) {
        this.parent.dom.appendChild(this.dom)
      }
    } catch (error) {
      logVerbose("Error in View builder: ", error)
      const viewMarkers = new RenderMarker(`view:${this.id}`)

      // clear the dom
      this.dom = document.createDocumentFragment()

      if (View.activeElement) {
        viewMarkers.appendToParent(View.activeElement)
      } else if (this.parent) {
        viewMarkers.appendToParent(this.parent.dom)
      } else {
        viewMarkers.appendToParent(this.dom)
      }

      // Display error message between markers
      displayErrorWithinMarkers(viewMarkers, error)
    }
  }

  disposeCallbacks: Set<Function> | null = null

  hooks = {
    onDispose: (callback: Function) => {
      if (View.active !== this) {
        logVerbose("onDispose() called outside of view")
      }
      if (!this.disposeCallbacks) {
        this.disposeCallbacks = new Set()
      }
      this.disposeCallbacks.add(callback)
    },
  }

  dispose() {
    for (const child of this.children) {
      child.dispose()
    }
    this.children.clear()

    if (this.disposeCallbacks) {
      for (const callback of this.disposeCallbacks) {
        callback()
      }
      this.disposeCallbacks.clear()
    }

    this._contextData?.clear()

    if (this.parent) {
      this.parent.children.delete(this)
    }
    unregisterView(this.id)
  }

  static active: View<any> | null = null
  static appendToActiveView(child: Node) {
    if (View.active) {
      View.active.dom.appendChild(child)
    } else {
      logVerbose("No active view")
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
      for (const child of children) {
        View.activeElement.appendChild(child)
      }
    } else {
      for (const child of children) {
        View.appendToActiveView(child)
      }
    }
  }
  static inNestedElement<T>(el: Node, fn: () => T): T {
    const prevActive = View.activeElement
    View.activeElement = el
    const result = fn()
    View.activeElement = prevActive
    return result
  }

  static inRenderContext<T>(
    newView = View.active,
    newElement = View.activeElement,
    fn: () => T
  ) {
    const prevView = View.active
    const prevElement = View.activeElement
    try {
      View.active = newView
      View.activeElement = newElement
      const result = fn()
      return result
    } catch (error) {
      logVerbose("Error in render context: ", error)
      throw error
    } finally {
      View.active = prevView
      View.activeElement = prevElement
    }
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

  static createBoundary(parent = View.active, element = View.activeElement) {
    return View.inRenderContext(parent, element, () => View.create(NOOP))
  }
}

/**
 * Registers a callback to be called when the active view is disposed.
 * @param callback
 */
export function onDispose(callback: Function) {
  if (View.active) {
    View.active.hooks.onDispose(callback)
  } else {
    logVerbose("No active view")
  }
}

export type Truthy = string | number | boolean | null | undefined
export function isTruthy(value: Truthy): boolean {
  return !!value
}

/**
 * Conditionally renders a view based on a boolean condition.
 *
 * @param condition A function that returns a boolean value (for use in a computation)
 * @param thenBuilder When the condition is true, this function is called to build the view, otherwise it is skipped/torn down.
 * @param elseBuilder (optional) When the condition is false, this function is called to build the view, otherwise it is skipped/torn down.
 */
export function when(
  condition: ISignal<Truthy> | Truthy | (() => Truthy | ISignal<Truthy>),
  thenBuilder: () => void,
  elseBuilder?: () => void
) {
  const id = Ident.create("when")
  const activeView = View.active
  const activeElement = View.activeElement

  const whenMarkers = new RenderMarker(id)
  if (activeElement) {
    whenMarkers.appendToParent(activeElement)
  } else if (activeView) {
    whenMarkers.appendToParent(activeView.dom)
  } else {
    return logVerbose("when(): No active view to append markers")
  }

  let container: DocumentFragment | null = null
  let hasError = false
  let boundary: View<any>

  const withinBoundary = <T>(
    container: DocumentFragment | null,
    fn: () => T
  ) => {
    if (!!boundary) boundary.dispose()
    boundary = View.createBoundary(activeView, container)
    return View.inRenderContext(boundary, View.activeElement, fn)
  }

  const renderBuilders = (runThenBuilder: boolean) => {
    if (hasError) {
      try {
        whenMarkers.removeBetween()
        hasError = false
      } catch (error) {
        logVerbose("Error removing 'when' error content:", error)
      }
    }

    if (container) {
      try {
        whenMarkers.removeBetween()
        container = null
      } catch (error) {
        logVerbose("Error removing 'when' content:", error)
      }
    }

    container = document.createDocumentFragment()

    try {
      View.inRenderContext(null, container, () => {
        withinBoundary(container, () => {
          if (runThenBuilder) {
            thenBuilder()
          } else if (elseBuilder) {
            elseBuilder()
          }
        })
      })

      whenMarkers.insertBetween(container)
    } catch (error) {
      logVerbose("Error in 'when' builder:", error)
      whenMarkers.removeBetween()
      displayErrorWithinMarkers(whenMarkers, error)
      container = null
      hasError = true
    }
  }

  effect(
    () => {
      const runThenBuilder = processCondition(condition)
      try {
        renderBuilders(runThenBuilder)
      } catch (error) {
        logVerbose("Error in 'when' effect:", error)
        whenMarkers.removeBetween()
        displayErrorWithinMarkers(whenMarkers, error)
        container = null
        hasError = true
      }
    },
    () => {
      if (boundary) boundary.dispose()
    }
  )

  // const sourceCondition = computed(() => {
  //   return processCondition(condition)
  // })
  // let hasRun = false
  // let lastCondition: Truthy
  // const stopReacting = sourceCondition.subscribe((runThenBuilder) => {
  //   if (hasRun && lastCondition === runThenBuilder)
  //     return
  //   renderBuilders(runThenBuilder)
  //   lastCondition = runThenBuilder
  //   hasRun = true
  // })

  activeView?.hooks.onDispose(() => {
    // stopReacting()
    if (boundary) boundary.dispose()
  })
}

export function processCondition(
  condition:
    | string
    | number
    | boolean
    | ISignal<Truthy>
    | (() => Truthy | ISignal<Truthy>)
    | null
    | undefined
): boolean {
  let runThenBuilder: boolean = false
  if (isSignal(condition)) {
    runThenBuilder = isTruthy(condition.value)
  } else if (isFunction(condition)) {
    const result = condition()
    if (isSignal(result)) {
      runThenBuilder = isTruthy(result.value)
    } else {
      runThenBuilder = isTruthy(result)
    }
  } else {
    runThenBuilder = isTruthy(condition)
  }
  return runThenBuilder
}

/**
 * Works kind of like `when`, but the whole block is evaluated and
 * re-rendered when any observed signals change.
 *
 * @param builder The function that builds the view
 * @returns void
 */
export function live(builder: () => void) {
  const id = Ident.create("live")
  const activeView = View.active
  const activeElement = View.activeElement

  const liveMarkers = new RenderMarker(id)
  if (activeElement) {
    liveMarkers.appendToParent(activeElement)
  } else if (activeView) {
    liveMarkers.appendToParent(activeView.dom)
  } else {
    return logVerbose("live(): No active view to append markers")
  }

  let container: DocumentFragment | null = null
  let hasError = false
  let boundary = View.createBoundary()

  effect(() => {
    if (hasError) {
      try {
        liveMarkers.removeBetween()
        hasError = false
      } catch (error) {
        logVerbose("Error removing 'live' error content:", error)
      }
    }

    if (container) {
      try {
        liveMarkers.removeBetween()
        container = null
      } catch (error) {
        logVerbose("Error removing 'live' content:", error)
      }
    }

    if (!!boundary) {
      boundary.dispose()
      boundary = View.createBoundary(activeView, activeElement)
    }

    container = document.createDocumentFragment()

    try {
      View.inRenderContext(boundary, container, builder)

      liveMarkers.insertBetween(container)
    } catch (error) {
      logVerbose("Error in 'live' builder:", error)
      displayErrorWithinMarkers(liveMarkers, error)
      hasError = true
    }
  })
}

/**
 * Renders an value as text.
 * @param value The value to display
 */
export function text(value: string | number | ISignal<any>) {
  if (isSignal(value)) {
    const id = Ident.create("text")
    const textMarkers = new RenderMarker(id)

    View.appendToActiveElements(textMarkers.start, textMarkers.end)
    const disposeLiveText = value.subscribe((val) => {
      const textValue = val
      textMarkers
        .removeBetween()
        .insertBetween(document.createTextNode(String(textValue)))
    })
    View.active?.hooks.onDispose(() => {
      disposeLiveText()
      textMarkers.removeBetween()
    })
    return
  }
  View.appendToActiveElement(document.createTextNode(String(value)))
}

export function raw(html: TemplateStringsArray | string, ...args: any[]) {
  if (typeof html === "string") {
    View.appendToActiveElement(
      document.createRange().createContextualFragment(html)
    )
    return
  }
  // Join the html with the args to make a single string
  const htmlString = html.reduce(
    (acc, str, i) => acc + str + (args[i] || ""),
    ""
  )
  View.appendToActiveElement(
    document.createRange().createContextualFragment(htmlString)
  )
}

export type KeyedView<T> = {
  key: any
  view: View<any>
  markers: RenderMarker
}

/**
 * Iterates over an array or signal containing an array, rendering views for each item.
 *
 * @param list - An array or signal containing an array of items.
 * @param itemBuilder - A function that receives each item and index, and builds the view.
 * @param options - Optional configuration, including a key extractor function.
 */
export function each<T>(
  list: T[] | ISignal<T[]> | Iterable<T> | ISignal<Iterable<T>>,
  itemBuilder: (item: T, index: number) => void,
  keyExtractor?: (item: T, index: number) => any
) {
  const id = Ident.create("each")
  const parentView = View.active
  const parentElement = View.activeElement

  const currentComputaiton = Computation.current

  const eachMarkers = new RenderMarker(id)
  if (parentElement) {
    eachMarkers.appendToParent(parentElement)
  } else if (parentView) {
    eachMarkers.appendToParent(parentView.dom)
  } else {
    return logVerbose("each(): No active view to append markers")
  }

  let hasWarnedAboutKeyExtractor = false
  let hasError = false
  let firstRun = true
  let boundary = View.createBoundary()
  let keyedViews = new Map<any, KeyedView<T>>()

  const sourceCom = computed(() => {
    return getValue(list)
  })

  const renderList = (source: T[] | Iterable<T>) => {
    try {
      if (hasError) {
        try {
          eachMarkers.removeBetween()
          hasError = false
        } catch (error) {
          logVerbose("Error removing 'each' error content:", error)
        }
      }

      let currentList = isIterable(source) ? Array.from(source) : source

      if (!Array.isArray(currentList)) {
        logVerbose(
          "each(): Provided list parameter is not an array",
          currentList
        )
        currentList = []
      }

      const newKeyedViews = new Map<any, KeyedView<T>>()
      const fragment = document.createDocumentFragment()

      for (const [index, item] of currentList.entries()) {
        let key = getKeyForItem<T>(index, keyExtractor, item)

        if (config.verbose && key === index && !hasWarnedAboutKeyExtractor) {
          console.warn(
            "Using index as key for each item. Consider providing a keyExtractor function."
          )
          hasWarnedAboutKeyExtractor = true
        }

        let keyedView = keyedViews.get(key)

        if (!keyedView) {
          const subview = View.createBoundary(boundary, boundary.dom)
          const viewId = Ident.create("each-item", key)
          const subviewMarkers = new RenderMarker(viewId)
          const viewFragment = document.createDocumentFragment()

          viewFragment.appendChild(subviewMarkers.start)

          const prevComputation = Computation.current
          View.inRenderContext(subview, subview.dom, () => {
            Computation.current = currentComputaiton
            itemBuilder(item, index)
          })
          Computation.current = prevComputation

          viewFragment.appendChild(subview.dom)
          viewFragment.appendChild(subviewMarkers.end)

          keyedView = {
            key,
            view: subview,
            markers: subviewMarkers,
          }
          fragment.appendChild(viewFragment)
        } // else a view already exists for this key, no need to rebuild

        newKeyedViews.set(key, keyedView)
      }

      if (firstRun) {
        // First run, just insert the fragment
        eachMarkers.insertBetween(fragment)

        firstRun = false
      } else {
        // Remove any keyed views that are no longer in the list
        for (const [key, keyedView] of keyedViews) {
          if (!newKeyedViews.has(key)) {
            keyedView.view.dispose()
            keyedView.markers.removeBetween()
            keyedView.markers.removeFromParent()
          }
        }

        // Rearrange the nodes to match the new order
        const parentNode = eachMarkers.start.parentNode
        if (parentNode) {
          let referenceNode = eachMarkers.start.nextSibling

          for (const keyedView of newKeyedViews.values()) {
            if (!keyedView.markers.start.isConnected) {
              // This is a new view, insert its nodes
              const nodesToInsert = keyedView.markers.extractAll()
              parentNode.insertBefore(nodesToInsert, referenceNode)
            } else if (referenceNode === keyedView.markers.start) {
              // Nodes are already in the correct position
              referenceNode = keyedView.markers.end.nextSibling
            } else {
              // Move the nodes to the correct position
              const nodesToMove = keyedView.markers.extractAll()
              parentNode.insertBefore(nodesToMove, referenceNode)
            }

            // Update referenceNode to the next node after the inserted nodes
            referenceNode = keyedView.markers.end.nextSibling // eachMarkers.end.nextSibling
          }
        } else {
          console.warn("Parent node not found for 'each' content")
        }
      }

      // Update keyedViews to the new set
      keyedViews = newKeyedViews
    } catch (error) {
      logVerbose("Error in 'each' effect:", error)
      eachMarkers.removeBetween()
      displayErrorWithinMarkers(eachMarkers, error)
      hasError = true
    }
  }

  const disposeEffect = sourceCom.subscribe((list) => {
    renderList(list)
  })

  if (parentView) {
    parentView.hooks.onDispose(() => {
      disposeEffect()
      for (const keyedView of keyedViews.values()) {
        keyedView.view.dispose()
      }
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
  [key in keyof HTMLElementTagNameMap]: ElementBuilder<
    Partial<MaybeSignal<Omit<HTMLElementTagNameMap[key], "style">>> &
      Partial<{
        class: string | ISignal<string>
        style: Partial<CSSStyleDeclaration> | string //| ISignal<string>
        ref: (el: HTMLElement) => void
        on: (
          event: keyof HTMLElementEventMap,
          callback: (e: Event | CustomEvent) => void
        ) => void
        use: (
          el: HTMLElement,
          helpers: ModifierBuilderContext<HTMLElementTagNameMap[key]>
        ) => void
        key: any
        switch: boolean | ISignal<boolean> // Safari-only for now
        $value: ISignal<any>
        $checked: ISignal<boolean>
        $selected: ISignal<boolean>
      }>,
    {},
    HTMLElementTagNameMap[key]
  >
} = new Proxy({} as any, {
  get(target, key: any) {
    if (!(key in target)) {
      target[key] = createElement(
        String(key).toLowerCase() as keyof HTMLElementTagNameMap
      )
    }
    return target[key]
  },
})

export function getKeyForItem<T>(
  index: number,
  keyExtractor: ((item: T, index: number) => any) | undefined,
  item: T
) {
  let key: any = index // Default key is the index
  if (typeof keyExtractor === "function") {
    key = keyExtractor(item, index)
    if (!key) {
      key = index
      logVerbose("Key extractor returned falsy value (using index)")
    }
  } else if ((item as any).id !== undefined) {
    key = (item as any).id
  } else if (typeof item === "string" || typeof item === "number") {
    key = index + ":" + item
  }
  return key
}

export function createElement<P = any, M = {}>(
  tag: keyof HTMLElementTagNameMap,
  classNames: string[] = [],
  modifiers?: ModifierBuilder<M, HTMLElementTagNameMap[typeof tag]>
): ElementBuilder<P, M, HTMLElementTagNameMap[typeof tag]> {
  const elementFn = Object.assign(
    function Element(props?: P, children?: Children) {
      return element<P, M, HTMLElementTagNameMap[typeof tag]>(
        tag,
        props,
        children,
        classNames,
        modifiers
      )
    },
    {
      extend<N>(
        cssOrModifiers:
          | (Partial<CSSStyleDeclaration> & CustomCSS)
          | ModifierBuilder<N, HTMLElementTagNameMap[typeof tag]>,
        newModifiers?: ModifierBuilder<N, HTMLElementTagNameMap[typeof tag]>
      ): ElementBuilder<P, M & N, HTMLElementTagNameMap[typeof tag]> {
        const cssString =
          typeof cssOrModifiers === "string"
            ? cssOrModifiers
            : typeof cssOrModifiers === "object"
            ? convertToNestedCss(cssOrModifiers)
            : undefined
        const modifiersFn: ModifierBuilder<
          N,
          HTMLElementTagNameMap[typeof tag]
        > =
          typeof cssOrModifiers === "function" ? cssOrModifiers : newModifiers!
        let extraClasses: string[] = []

        if (cssString) {
          const cssClass = withAutoScope(() => cssTemplate([cssString] as any))
          extraClasses.push(cssClass)
        }

        const combinedModifiers: ModifierBuilder<
          M & N,
          HTMLElementTagNameMap[typeof tag]
        > = (baseModifiers, context) => {
          const prev = modifiers ? modifiers(baseModifiers, context) : ({} as M)
          const next = modifiersFn
            ? modifiersFn(baseModifiers, context)
            : ({} as N)
          const merged = { ...prev, ...next } as M & N
          return merged
          // update merged to support chaining... Not sure I need to do
          // this now that I'm using the chainable helper
          // return Object.keys(merged as any).reduce((modifiers: any, key) => {
          //   modifiers[key] = (...args: any[]) => {
          //     ;(merged as any)[key](...args)
          //     return merged
          //   }
          //   return modifiers
          // }, {} as M & N)
        }

        return createElement<P, M & N>(
          tag,
          [...extraClasses, ...classNames],
          combinedModifiers
        )
      },
    }
  ) as ElementBuilder<P, M, HTMLElementTagNameMap[typeof tag]>
  return elementFn
}

export function camelToKebab(str: string) {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2").toLowerCase()
}

export function convertToStyles(styles: Partial<CSSStyleDeclaration>) {
  return Object.keys(styles).reduce((acc: string, key: any) => {
    return acc + `${camelToKebab(key)}: ${styles[key]};`
  }, "")
}

export function convertToNestedCss(
  styles: Partial<CSSStyleDeclaration> & CssRecord
): string {
  return Object.keys(styles)
    .reduce((acc: string, key: string) => {
      const value = styles[key]

      if (typeof value === "object" && !Array.isArray(value)) {
        const nestedStyles = convertToNestedCss(value as any)
        return acc + `${key} { ${nestedStyles} } `
      } else {
        return acc + `${camelToKebab(key)}: ${value}; `
      }
    }, "")
    .trim()
}

/**
 * Renders a view instance into a target element.
 *
 * @param viewInstance  The view instance to render
 * @param target The target element to render the view into
 * @returns A function that can be called to dispose of the view
 */
export function render(viewInstance: View<any>, target: HTMLElement) {
  let id = Ident.create("pulse")
  let renderMarkers = new RenderMarker(id)

  _activeRoots.add(viewInstance)

  target.appendChild(renderMarkers.start)
  let source = viewInstance.dom
  if (Array.isArray(source)) {
    for (const el of source) {
      target.appendChild(el)
    }
  } else {
    target.appendChild(source)
  }
  target.appendChild(renderMarkers.end)

  let isDisposed = false
  return () => {
    if (isDisposed) return
    viewInstance.dispose()
    renderMarkers.removeBetween()
    renderMarkers.removeFromParent()
    _activeRoots.delete(viewInstance)
    isDisposed = true
    //@ts-ignore
    renderMarkers = void 0
    //@ts-ignore
    source = void 0
    //@ts-ignore
    target = void 0
  }
}

export function element<P, M, E extends HTMLElement>(
  name: string,
  props: any = EMPTY_PROPS,
  children: Children = EMPTY_CHILDREN,
  customClasses: string[] = [],
  customModifiers?: ModifierBuilder<M, E>
): ElementModifiers<M, E> {
  const el: E = document.createElement(name) as E

  if (typeof props === "function") {
    children = props
    props = {} as P
  }

  if (
    typeof props === "string" ||
    typeof props === "number" ||
    isSignal(props)
  ) {
    children = props as any
    props = {} as P
  }

  for (const key in props) {
    if (key === "class" || key === "className") {
      setElProp(el, "className", props[key])
    } else if (key.startsWith("on")) {
      const handler = props[key]
      const eventName = key.slice(2).toLowerCase()
      el.addEventListener(eventName, handler)
      // should this be disposed?
      View.active?.hooks.onDispose(() => {
        el.removeEventListener(eventName, handler)
      })
    } else if (key === "style") {
      if (typeof props[key] === "string") el.style.cssText = props[key]
      else
        for (const styleKey in props[key]) {
          // TODO: Test this
          setElProp(el.style as any, styleKey, props[key][styleKey])
        }
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
      const activeView = View.active
      queueMicrotask(() => {
        const dispose = props[key](el)
        if (typeof dispose === "function") {
          if (activeView) activeView.hooks.onDispose(dispose)
          else logVerbose("No active view to dispose")
        }
      })
    } else if (key.startsWith("$")) {
      const attrName = key.slice(1)
      // Set up two-way binding
      if (isMutableSignal(props[key])) {
        const signal = props[key]
        const dispose = signal.subscribe((value) => {
          //@ts-ignore
          if (el[attrName] !== value) {
            setElProp(el, attrName, value)
          }
        })
        View.active?.hooks.onDispose(dispose)
        const handler = (e: InputEvent) => {
          signal.set((e.target as any)[attrName])
        }
        el.addEventListener("input", handler)
        View.active?.hooks.onDispose(() => {
          el.removeEventListener("input", handler)
        })
      } else {
        if (key in el) {
          setElProp(el, key, props[key])
        } else {
          setElAttr(el, key, props[key])
        }
      }
    } else {
      if (key in el) {
        setElProp(el, key, props[key])
      } else {
        setElAttr(el, key, props[key])
      }
    }
  }

  if (customClasses.length) {
    for (const cls of customClasses) {
      el.classList.add(cls)
    }
  }

  View.appendToActiveElement(el)

  View.inNestedElement(el, () => {
    const result = typeof children == "function" ? children() : children
    const resultType = typeof result
    if (resultType === "string" || resultType === "number") {
      el.appendChild(document.createTextNode(String(result)))
    } else if (isSignal(result)) {
      const disposeLiveChildren = result.subscribe((val) => {
        const value = val
        el.textContent = String(value)
      })
      View.active?.hooks.onDispose(disposeLiveChildren)
    } else if (resultType != "undefined") {
      logVerbose("Invalid children (ignoring)", {
        element: { name, el },
        result,
      })
    }
  })

  let modifiers = createBaseModifiers<E>(el)

  if (customModifiers) {
    let extraModifiers = {} as M
    const context = createModifierContext<E>(el)

    extraModifiers = customModifiers(modifiers, context)
    modifiers = Object.assign(modifiers, extraModifiers)
  }

  const chainableModifiers = makeChainable(modifiers)
  return chainableModifiers as ElementModifiers<M, E>
}

export function createModifierContext<E extends HTMLElement>(el: E) {
  return {
    element: el,
    onDispose: (callback: Function) => {
      View.active?.hooks.onDispose(callback)
    },
    bindValue: <T>(value: ReactiveValue<T>, callback: ReactiveCallback<T>) => {
      const dispose = bindValue(value, callback)
      View.active?.hooks.onDispose(dispose)
    },
    bindEvent: <T extends keyof HTMLElementEventMap>(
      event: T,
      callback: (e: HTMLElementEventMap[T]) => void
    ) => {
      const dispose = bindEvent(el, event, callback)
      View.active?.hooks.onDispose(dispose)
    },
  } as ModifierBuilderContext<E>
}

export function createBaseModifiers<T extends HTMLElement>(el: T) {
  const modifiers = {
    className: (...args: any[]) => {
      const classes = classNames(...args)
      el.classList.add(classes)
      return modifiers
    },
    css: (styles: CustomStyleCSS) => {
      const currentStyles = el.getAttribute("style") || ""
      if (typeof styles === "string") {
        el.style.cssText = currentStyles + styles
      } else {
        el.style.cssText = currentStyles + convertToStyles(styles)
      }
      return modifiers
    },
    inert(freeze?: ReactiveValue<boolean>) {
      const dispose = bindValue(freeze, (value) => {
        el.toggleAttribute("inert", value)
      })
      View.active?.hooks.onDispose(dispose)
      return modifiers
    },
    on(
      event: keyof HTMLElementEventMap,
      callback: (e: Event | CustomEvent) => void
    ) {
      el.addEventListener(event, callback)
      View.active?.hooks.onDispose(() => {
        el.removeEventListener(event, callback)
      })
      return modifiers
    },
    transitionName(name: string) {
      //@ts-ignore
      el.style.viewTransitionName = name
      return modifiers
    },
    use(callback: (element: T, context: ModifierBuilderContext<T>) => void) {
      const ctx = createModifierContext(el)
      const dispose = callback(el, ctx)
      if (typeof dispose === "function") View.active?.hooks.onDispose(dispose)
      return modifiers
    },
  }
  return modifiers
}

export function setElAttr(el: Element, key: string, value: any) {
  if (isSignal(value)) {
    const disposeLiveAttr = value.subscribe((val) => {
      el.setAttribute(key, String(val))
    })
    View.active?.hooks.onDispose(disposeLiveAttr)
  } else {
    el.setAttribute(key, String(value))
  }
}
export function setElProp(el: Element, key: string, value: any) {
  if (isSignal(value)) {
    const disposeLiveAttr = value.subscribe((val) => {
      ;(el as any)[key] = val
    })
    View.active?.hooks.onDispose(disposeLiveAttr)
  } else {
    ;(el as any)[key] = value
  }
}

export function extractPropsAndChildren<P>(args: any[]): [P, Children] {
  if (args.length === 0) {
    return [EMPTY_PROPS as P, EMPTY_CHILDREN]
  } else if (typeof args[0] === "function") {
    return [EMPTY_PROPS as P, args[0]]
  } else {
    return [args[0], args[1] || EMPTY_CHILDREN]
  }
}

export class RenderMarker {
  start: Comment
  end: Comment
  constructor(public readonly id: string) {
    this.start = document.createComment(id)
    this.end = document.createComment(`/${id}`)
  }
  appendToParent(parent: Node) {
    parent.appendChild(this.start)
    parent.appendChild(this.end)
    return this
  }
  removeFromParent() {
    this.start.remove()
    this.end.remove()
  }
  insertBetween(node: Node) {
    if (this.end.parentNode) {
      this.end.parentNode.insertBefore(node, this.end)
    }
    return this
  }
  removeBetween() {
    if (this.start.isConnected) {
      const range = document.createRange()
      range.setStartAfter(this.start)
      range.setEndBefore(this.end)
      range.deleteContents()
    }
    return this
  }
  extractAll() {
    const fragment = document.createDocumentFragment()
    let currentNode: Node | null = this.start
    while (currentNode) {
      const nextNode: Node | null = currentNode.nextSibling
      fragment.appendChild(currentNode)
      if (currentNode === this.end) break
      currentNode = nextNode
    }
    return fragment
  }
}

export function displayErrorWithinMarkers(markers: RenderMarker, error: any) {
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
  markers.insertBetween(errorMessage)
}

export function makeChainable<T extends object>(obj: T): Chainable<T> {
  const chainableObj: any = {}
  for (const key of Object.keys(obj)) {
    const value = (obj as any)[key]
    if (typeof value === "function") {
      chainableObj[key] = function (...args: any[]) {
        value.apply(obj, args)
        return chainableObj
      }
    } else {
      chainableObj[key] = value
    }
  }
  return chainableObj
}

/**
 * A value, signal, or function that can be used to create a reactive value.
 */
export type ReactiveValue<T> = T | ISignal<T> | (() => T)
/**
 * A callback that is called when a reactive value changes.
 */
export type ReactiveCallback<T> = (unwrappedValue: T) => void

/**
 * Unwraps a reactive value to its base value. (untracked)
 */
export function getValue<T>(value: ReactiveValue<T>): T {
  return isSignal(value) ? value.value : isFunction(value) ? value() : value
}
/**
 * Binds a reactive value to a callback, executing whenever the value changes.
 */
export function bindValue<T>(
  value: ReactiveValue<T>,
  callback: ReactiveCallback<T>
): () => void {
  if (isSignal(value)) {
    return value.subscribe(callback)
  } else if (isFunction(value)) {
    const dynamicComputed = computed(() => value())
    return dynamicComputed.subscribe(callback)
  } else {
    callback(value)
    return NOOP
  }
}
export function bindEvent(
  element: HTMLElement,
  event: keyof HTMLElementEventMap,
  callback: (e: HTMLElementEventMap[typeof event]) => void
): () => void {
  element.addEventListener(event, callback)
  return () => element.removeEventListener(event, callback)
}

export function isIterable<T>(value: any): value is Iterable<T> {
  return value !== null && typeof value[Symbol.iterator] === "function"
}
export function isFunction(source: any): source is Function {
  return typeof source === "function"
}

export function isView(value: any): value is View<any> {
  return value instanceof View
}

export function iife<T>(fn: () => T): T {
  return fn()
}

/**
 * Defines a custom element tag that will render a Pulse view.
 *
 * @param tagName - The name of the custom element tag to define.
 * @param observedProps - The names of the properties that will be observed for changes.
 * @param viewFactory - A function that creates a Pulse view.
 */
export function customPulseElement(
  tagName: string,
  observedProps: string[],
  viewFactory: ViewFactory<any>
) {
  if (customElements.get(tagName)) {
    return console.warn(`${tagName} already defined`)
  }
  customElements.define(
    tagName,
    class PulseViewCustomTag extends HTMLElement {
      static observedProps = observedProps
      static observedAttributes = observedProps
      props: Record<string, IMutableSignal<any>>
      dispose: () => void | undefined

      constructor() {
        super()
        this.props = { innerHTML: this.innerHTML as any }
        this.innerHTML = ""
        for (const prop of observedProps) {
          this.props[prop] = signal(this.getAttribute(prop))
        }
      }

      attributeChangedCallback(
        name: string,
        _oldValue: string,
        newValue: string
      ) {
        this.props[name]?.set(newValue)
      }

      connectedCallback() {
        this.dispose = render(viewFactory(this.props), this)
      }

      disconnectedCallback() {
        this.dispose?.()
      }
    }
  )
}
