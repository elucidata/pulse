import {
  config,
  effect,
  isSignal,
  ISignal,
  untracked,
  isMutableSignal,
  Ident,
  withIdPrefix,
} from "../internals"
import {
  css as cssTemplate,
  applyStylesToDOM,
  withAutoScope,
  classNames,
} from "./css"

// export * from "../internals"

export const viewRegistry = new Map<string, any>()
//@ts-ignore
globalThis.pulseViewRegistry = viewRegistry

export interface ViewFactory<P> {
  (): View<P>
  (props: P): View<P>
  (children: Children): View<P>
  (props: P, children: Children): View<P>
  styles(css: string): ViewFactory<P>
}

export type Children = () => void | string | number | ISignal<any>

export type ViewHooks = {
  onDispose: (callback: Function) => void
}

export type DomBuilder<P = any> = (
  props: P,
  children: Children,
  api: ViewHooks
) => void

export interface Designable<M> {
  design: {
    css(
      styles: TemplateStringsArray | string,
      ...args: any[]
    ): ElementBuilder<any, M, any> & Designable<M>
  }
}
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

  extend(css: CustomCSS): ElementBuilder<P, M, E> & Designable<M>
  extend<N>(
    modifiers: ModifierBuilder<N, E>
  ): ElementBuilder<P, M & N, E> & Designable<M & N>
  extend<N>(
    css: CustomCSS,
    modifiers: ModifierBuilder<N, E>
  ): ElementBuilder<P, M & N, E> & Designable<M & N>
} & Designable<M>

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
  classNames: (...args: any[]) => BaseModifiers<E>
  inert: (freeze?: ReactiveValue<boolean>) => BaseModifiers<E>
  style: (styles: CustomStyleCSS) => BaseModifiers<E>
  transitionName: (name: string) => BaseModifiers<E>
  use: (callback: (element: E) => void) => BaseModifiers<E>
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

export const activeRoots = new Set<View<any>>()

function logVerbose(...messages: any) {
  if (config.verbose) {
    console.warn("[Pulse View]", ...messages)
  }
}

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
      styles(css: string) {
        applyStylesToDOM(css)
        return this
      },
    }
  )
}

export class View<P> {
  readonly id = Ident.create()
  readonly dom: DocumentFragment
  readonly parent: View<any> | null = null
  readonly children: Set<View<any>> = new Set()
  readonly props: P

  env?: Map<string, any>

  constructor(private _builder: DomBuilder, args: any[]) {
    viewRegistry.set(this.id, this)
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
      const { startMarker, endMarker } = createRenderMarkers(`view:${this.id}`)

      // clear the dom
      this.dom = document.createDocumentFragment()

      if (View.activeElement) {
        View.activeElement.appendChild(startMarker)
        View.activeElement.appendChild(endMarker)
      } else if (this.parent) {
        this.parent.dom.appendChild(startMarker)
        this.parent.dom.appendChild(endMarker)
      } else {
        this.dom.appendChild(startMarker)
        this.dom.appendChild(endMarker)
      }

      // Display error message between markers
      displayError(startMarker!, endMarker!, error)
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

    if (this.parent) {
      this.parent.children.delete(this)
    }
    viewRegistry.delete(this.id)
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
 * Gets the value of an environment variable.
 *
 * @param key
 * @returns The value of the environment variable or `undefined` if it doesn't exist.
 */
export function getEnv<T>(key: string): T | undefined {
  if (View.active) {
    return View.active.getEnv<T>(key)
  }
  logVerbose("No active view")
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
    logVerbose("No active view")
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

/**
 * Conditionally renders a view based on a boolean condition.
 *
 * @param condition A function that returns a boolean value (for use in a computation)
 * @param thenBuilder When the condition is true, this function is called to build the view, otherwise it is skipped/torn down.
 * @param elseBuilder (optional) When the condition is false, this function is called to build the view, otherwise it is skipped/torn down.
 */
export function when(
  condition: ISignal<boolean> | boolean | (() => boolean | ISignal<boolean>),
  thenBuilder: () => void,
  elseBuilder?: () => void
) {
  const id = Ident.create("when")
  const activeView = View.active
  const activeElement = View.activeElement

  const { startMarker, endMarker } = createRenderMarkers(id)
  if (activeElement) {
    activeElement.appendChild(startMarker)
    activeElement.appendChild(endMarker)
  } else if (activeView) {
    activeView.dom.appendChild(startMarker)
    activeView.dom.appendChild(endMarker)
  } else {
    logVerbose("when(): No active view to append markers")
    return
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

  effect(
    () => {
      let runThenBuilder: boolean | ISignal<boolean> = false
      if (isSignal(condition)) {
        runThenBuilder = condition.value
      } else if (typeof condition === "boolean") {
        runThenBuilder = condition
      } else {
        runThenBuilder = condition()
      }
      if (isSignal(runThenBuilder)) {
        runThenBuilder = runThenBuilder.value
      }

      if (hasError) {
        try {
          removeBetweenMarkers(startMarker, endMarker)
          hasError = false
        } catch (error) {
          logVerbose("Error removing 'when' error content:", error)
        }
      }

      if (container) {
        try {
          removeBetweenMarkers(startMarker, endMarker)
          container = null
        } catch (error) {
          logVerbose("Error removing 'when' content:", error)
        }
      }

      container = document.createDocumentFragment()

      try {
        View.inRenderContext(null, container, () => {
          untracked(() => {
            withinBoundary(container, () => {
              if (runThenBuilder) {
                thenBuilder()
              } else if (elseBuilder) {
                elseBuilder()
              }
            })
          })
        })

        insertBetweenMarkers(container, startMarker, endMarker)
      } catch (error) {
        logVerbose("Error in 'when' builder:", error)
        removeBetweenMarkers(startMarker, endMarker)
        displayError(startMarker, endMarker, error)
        container = null
        hasError = true
      }
    },
    (err) => {
      logVerbose("Error in 'when' effect:", err)
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
  const id = Ident.create("live")
  const activeView = View.active
  const activeElement = View.activeElement

  const { startMarker, endMarker } = createRenderMarkers(id)
  if (activeElement) {
    activeElement.appendChild(startMarker)
    activeElement.appendChild(endMarker)
  } else if (activeView) {
    activeView.dom.appendChild(startMarker)
    activeView.dom.appendChild(endMarker)
  } else {
    logVerbose("live(): No active view to append markers")
    return
  }

  let container: DocumentFragment | null = null
  let hasError = false
  let boundary = View.createBoundary()

  effect(() => {
    if (hasError) {
      try {
        removeBetweenMarkers(startMarker, endMarker)
        hasError = false
      } catch (error) {
        logVerbose("Error removing 'live' error content:", error)
      }
    }

    if (container) {
      try {
        removeBetweenMarkers(startMarker, endMarker)
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

      insertBetweenMarkers(container, startMarker, endMarker)
    } catch (error) {
      logVerbose("Error in 'live' builder:", error)
      displayError(startMarker, endMarker, error)
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
    const { startMarker, endMarker } = createRenderMarkers(id)

    View.appendToActiveElements(startMarker, endMarker)
    const disposeLiveText = effect(() => {
      const textValue = value.value
      removeBetweenMarkers(startMarker, endMarker)
      insertBetweenMarkers(
        document.createTextNode(String(textValue)),
        startMarker,
        endMarker
      )
    })
    View.active?.hooks.onDispose(() => {
      disposeLiveText()
      removeBetweenMarkers(startMarker, endMarker)
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
  startMarker: Comment
  endMarker: Comment
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

  const { startMarker, endMarker } = createRenderMarkers(id)
  if (parentElement) {
    parentElement.appendChild(startMarker)
    parentElement.appendChild(endMarker)
  } else if (parentView) {
    parentView.dom.appendChild(startMarker)
    parentView.dom.appendChild(endMarker)
  } else {
    logVerbose("each(): No active view to append markers")
    return
  }

  let hasWarnedAboutKeyExtractor = false
  let hasError = false
  let firstRun = true
  let boundary = View.createBoundary()
  let keyedViews = new Map<any, KeyedView<T>>()

  const disposeEffect = effect(
    () => {
      if (hasError) {
        try {
          removeBetweenMarkers(startMarker, endMarker)
          hasError = false
        } catch (error) {
          logVerbose("Error removing 'each' error content:", error)
        }
      }

      const source = getValue(list)
      let currentList = isIterable(source) ? Array.from(source) : source

      if (!Array.isArray(currentList)) {
        logVerbose("each(): Provided list is not an array", currentList)
        currentList = []
      }

      const newKeyedViews = new Map<any, KeyedView<T>>()
      const fragment = document.createDocumentFragment()

      for (const [index, item] of currentList.entries()) {
        let key: any = getKeyForItem<T>(index, keyExtractor, item)

        if (config.verbose && key === index && !hasWarnedAboutKeyExtractor) {
          console.warn(
            "Using index as key for each item. Consider providing a keyExtractor function."
          )
          hasWarnedAboutKeyExtractor = true
        }

        let keyedView = keyedViews.get(key)

        if (!keyedView) {
          const subview = View.createBoundary(boundary, boundary.dom)
          const viewId = Ident.create("each-item")
          const { startMarker: viewStart, endMarker: viewEnd } =
            createRenderMarkers(viewId)
          const viewFragment = document.createDocumentFragment()

          viewFragment.appendChild(viewStart)

          View.inRenderContext(subview, subview.dom, () =>
            itemBuilder(item, index)
          )

          viewFragment.appendChild(subview.dom)
          viewFragment.appendChild(viewEnd)

          keyedView = {
            key,
            view: subview,
            startMarker: viewStart,
            endMarker: viewEnd,
          }
          fragment.appendChild(viewFragment)
        } // else a view already exists for this key, no need to rebuild

        newKeyedViews.set(key, keyedView)
      }

      if (firstRun) {
        // First run, just insert the fragment
        removeBetweenMarkers(startMarker, endMarker)
        insertBetweenMarkers(fragment, startMarker, endMarker)

        firstRun = false
      } else {
        // Remove any keyed views that are no longer in the list
        for (const [key, keyedView] of keyedViews) {
          if (!newKeyedViews.has(key)) {
            keyedView.view.dispose()
            removeBetweenMarkers(keyedView.startMarker, keyedView.endMarker)
          }
        }

        // Rearrange the nodes to match the new order
        const parentNode = startMarker.parentNode
        if (parentNode) {
          let referenceNode = startMarker.nextSibling

          for (const keyedView of newKeyedViews.values()) {
            const { startMarker, endMarker } = keyedView

            // Check if the node is already in the correct position
            if (referenceNode === startMarker) {
              // Nodes are already in the correct position
              referenceNode = endMarker.nextSibling
            } else {
              // Move the nodes to the correct position
              const nodesToMove = extractNodesIncludingMarkers(
                startMarker,
                endMarker
              )
              parentNode.insertBefore(nodesToMove, referenceNode)
            }

            // Update referenceNode to the next node after the inserted nodes
            referenceNode = endMarker.nextSibling
          }
        } else {
          console.warn("Parent node not found for 'each' content")
        }
      }

      // Update keyedViews to the new set
      keyedViews = newKeyedViews
    },
    (error) => {
      logVerbose("Error in 'each' effect:", error)
      removeBetweenMarkers(startMarker, endMarker)
      displayError(startMarker, endMarker, error)
      hasError = true
    }
  )

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
        use: (el: HTMLElement) => void
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
      design: {
        css: (styles: TemplateStringsArray | string, ...args: any[]) => {
          const src = typeof styles === "string" ? [styles] : styles
          const css = withAutoScope(() => cssTemplate(src as any, ...args))
          return createElement<P, M>(tag, [css, ...classNames], modifiers)
        },
      },

      extend<N>(
        cssOrModifiers:
          | (Partial<CSSStyleDeclaration> & CustomCSS)
          | ModifierBuilder<N, HTMLElementTagNameMap[typeof tag]>,
        newModifiers?: ModifierBuilder<N, HTMLElementTagNameMap[typeof tag]>
      ): ElementBuilder<P, M & N, HTMLElementTagNameMap[typeof tag]> &
        Designable<M & N> {
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
    } as Designable<M>
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
  const id = Ident.create("pulse")
  const { startMarker, endMarker } = createRenderMarkers(id)

  activeRoots.add(viewInstance)

  target.appendChild(startMarker)
  const source = viewInstance.dom
  if (Array.isArray(source)) {
    for (const el of source) {
      target.appendChild(el)
    }
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

export function element<P, M, E extends HTMLElement>(
  name: string,
  props: any = EMPTY_PROPS,
  children: Children = EMPTY_CHILDREN,
  customClasses: string[] = [],
  customModifiers?: ModifierBuilder<M, E>
): ElementModifiers<M, E> {
  // const activeView = View.active
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
      const disposeLiveChildren = effect(() => {
        const value = result.value
        el.textContent = String(value)
      })
      View.active?.hooks.onDispose(disposeLiveChildren)
    } else if (resultType != "undefined") {
      logVerbose("Invalid children", result)
    }
  })

  let modifiers = createBaseModifiers<E>(el)

  if (customModifiers) {
    let extraModifiers = {} as M
    const context = {
      element: el,
      onDispose: (callback: Function) => {
        View.active?.hooks.onDispose(callback)
      },
      bindValue: <T>(
        value: ReactiveValue<T>,
        callback: ReactiveCallback<T>
      ) => {
        View.active?.hooks.onDispose(bindValue(value, callback))
      },
      bindEvent: <T extends keyof HTMLElementEventMap>(
        event: T,
        callback: (e: HTMLElementEventMap[T]) => void
      ) => {
        View.active?.hooks.onDispose(bindEvent(el, event, callback))
      },
    }

    extraModifiers = customModifiers(modifiers, context)
    modifiers = Object.assign(modifiers, extraModifiers)
  }

  const chainableModifiers = makeChainable(modifiers)
  return chainableModifiers as ElementModifiers<M, E>
}

export function createBaseModifiers<T extends HTMLElement>(el: T) {
  const modifiers = {
    classNames: (...args: any[]) => {
      const classes = classNames(...args)
      el.classList.add(classes)
      return modifiers
    },
    inert(freeze?: ReactiveValue<boolean>) {
      bindValue(freeze, (value) => {
        el.toggleAttribute("inert", value)
      })
      return modifiers
    },
    style: (styles: CustomStyleCSS) => {
      const currentStyles = el.getAttribute("style") || ""
      if (typeof styles === "string") {
        el.style.cssText = currentStyles + styles
      } else {
        el.style.cssText = currentStyles + convertToStyles(styles)
      }
      return modifiers
    },
    transitionName(name: string) {
      //@ts-ignore
      el.style.viewTransitionName = name
      return modifiers
    },
    use(callback: (element: T) => void) {
      const dispose = callback(el)
      if (typeof dispose === "function") View.active?.hooks.onDispose(dispose)
      return modifiers
    },
  }
  return modifiers
}

export function setElAttr(el: Element, key: string, value: any) {
  if (isSignal(value)) {
    const disposeLiveAttr = effect(() => {
      el.setAttribute(key, String(value.value))
    })
    View.active?.hooks.onDispose(disposeLiveAttr)
  } else {
    el.setAttribute(key, String(value))
  }
}
export function setElProp(el: Element, key: string, value: any) {
  if (isSignal(value)) {
    const disposeLiveAttr = effect(() => {
      ;(el as any)[key] = value.value
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

export function createRenderMarkers(id: string) {
  const startMarker = document.createComment(id)
  const endMarker = document.createComment(`/${id}`)
  return { startMarker, endMarker }
}

export function insertBetweenMarkers(node: Node, start: Comment, end: Comment) {
  if (end.parentNode) {
    end.parentNode.insertBefore(node, end)
  }
}

export function removeBetweenMarkers(start: Comment, end: Comment) {
  if (start.isConnected) {
    const range = document.createRange()
    range.setStartAfter(start)
    range.setEndBefore(end)
    range.deleteContents()
  }
}

export function extractNodesIncludingMarkers(
  startNode: Node,
  endNode: Node
): DocumentFragment {
  const fragment = document.createDocumentFragment()
  let currentNode: Node | null = startNode

  while (currentNode) {
    const nextNode: Node | null = currentNode.nextSibling
    fragment.appendChild(currentNode)
    if (currentNode === endNode) break
    currentNode = nextNode
  }

  return fragment
}

export function displayError(
  startMarker: Comment,
  endMarker: Comment,
  error: any
) {
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

export type ReactiveValue<T> = T | ISignal<T>
export type ReactiveCallback<T> = (unwrappedValue: T) => void

export function getValue<T>(value: ReactiveValue<T>): T {
  return isSignal(value) ? value.value : value
}

export function bindValue<T>(
  value: ReactiveValue<T>,
  callback: ReactiveCallback<T>
): () => void {
  if (isSignal(value)) {
    return value.subscribe(callback)
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
