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

export * from "../internals"

const viewRegistry = new Map<string, any>()
//@ts-ignore
globalThis.pulseViewRegistry = viewRegistry

interface ViewFactory<P> {
  (): View<P>
  (props: P): View<P>
  (children: Children): View<P>
  (props: P, children: Children): View<P>
  styles(css: string): ViewFactory<P>
}

type Children = () => void | string | number | ISignal<any>

type ViewHooks = {
  onDispose: (callback: Function) => void
}

type DomBuilder<P = any> = (
  props: P,
  children: Children,
  api: ViewHooks
) => void

interface Designable<M> {
  design: {
    css(
      styles: TemplateStringsArray | string,
      ...args: any[]
    ): ElementBuilder<any, M> & Designable<M>
  }
}

type ElementBuilder<P, M> = {
  (props: P, children: Children): ElementModifiers<M>
  (props: P): ElementModifiers<M>
  (children: Children): ElementModifiers<M>
  (): ElementModifiers<M>

  extend(css: string): ElementBuilder<P, M> & Designable<M>
  extend<N>(
    modifiers: ModifierBuilder<N>
  ): ElementBuilder<P, M & N> & Designable<M & N>
  extend<N>(
    css: string,
    modifiers: ModifierBuilder<N>
  ): ElementBuilder<P, M & N> & Designable<M & N>
} & Designable<M>

type ModifierBuilder<N> = (
  modifiers: BaseModifiers,
  context: ModifierBuilderContext
) => N

type ModifierBuilderContext = {
  element: HTMLElement
  onDispose: (callback: Function) => void
  bindValue: <T>(value: ReactiveValue<T>, callback: ReactiveCallback<T>) => void
  bindEvent: <T extends keyof HTMLElementEventMap>(
    event: T,
    callback: (e: HTMLElementEventMap[T]) => void
  ) => void
}

type BaseModifiers = ReturnType<typeof createBaseModifiers>

type ElementModifiers<M> = Chainable<BaseModifiers & M>

type MaybeSignal<T> = {
  [P in keyof T]: T[P] | ISignal<T[P]>
}

type Chainable<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => any
    ? (...args: A) => Chainable<T>
    : T[K]
}

export type ExtractProps<T> = T extends ElementBuilder<infer P, any> ? P : never

const NOOP = () => {}
// const IDENT = <T>(input: T): T => input
const EMPTY_PROPS = {}
const EMPTY_CHILDREN: Children = NOOP

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
  const idPrefix = Ident.prefix
  return Object.assign(
    function instantiate(...args: any[]) {
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
      config.verbose && console.error("Error in View builder:", error)
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
        config.verbose && console.warn("onDispose() called outside of view")
        // return // this breaks 'use' attributes
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
    viewRegistry.delete(this.id)
  }

  static active: View<any> | null = null
  static appendToActiveView(child: Node) {
    if (View.active) {
      View.active.dom.appendChild(child)
    } else {
      config.verbose && console.warn("No active view")
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
      config.verbose && console.error("Error in render context:", error)
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
    config.verbose && console.warn("No active view")
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
    config.verbose && console.warn("No active view")
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
    config.verbose && console.warn("when(): No active view to append markers")
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
        config.verbose && console.warn("Error in 'when' builder:", error)
        removeBetweenMarkers(startMarker, endMarker)
        displayError(startMarker, endMarker, error)
        container = null
        hasError = true
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
    config.verbose && console.warn("live(): No active view to append markers")
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
      boundary = View.createBoundary(activeView, activeElement)
    }

    container = document.createDocumentFragment()

    try {
      View.inRenderContext(boundary, container, builder)

      insertBetweenMarkers(container, startMarker, endMarker)
    } catch (error) {
      config.verbose && console.warn("Error in 'live' builder:", error)
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
  list: T[] | ISignal<T[]>,
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
    config.verbose && console.warn("each(): No active view to append markers")
    return
  }

  let keyedViews = new Map<any, KeyedView<T>>()
  let hasError = false
  let hasWarnedAboutKeyExtractor = false
  let boundary = View.createBoundary()

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

      let currentList: T[]
      if (isSignal(list)) {
        currentList = list.value
      } else {
        currentList = list
      }
      if (!Array.isArray(currentList)) {
        config.verbose &&
          console.error("each(): Provided list is not an array", currentList)
        currentList = []
      }

      const newKeyedViews = new Map<any, KeyedView<T>>()
      const fragment = document.createDocumentFragment()

      currentList.forEach((item, index) => {
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
          const subview = View.createBoundary(boundary, boundary.dom)
          View.inRenderContext(subview, subview.dom, () =>
            itemBuilder(item, index)
          )

          keyedView = { key, view: subview }
        } // else a view already exists for this key, no need to rebuild

        newKeyedViews.set(key, keyedView)
        const clone = keyedView.view.dom.cloneNode(true)
        fragment.appendChild(clone)
      })

      keyedViews.forEach((keyedView, key) => {
        if (!newKeyedViews.has(key)) {
          keyedView.view.dispose()
        }
      })

      keyedViews = newKeyedViews

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
  [key in keyof HTMLElementTagNameMap]: ElementBuilder<
    Partial<MaybeSignal<Omit<HTMLElementTagNameMap[key], "style">>> &
      Partial<{
        class: string | ISignal<string>
        style: CSSStyleDeclaration | string //| ISignal<string>
        ref: (el: HTMLElement) => void
        use: (el: HTMLElement) => void
        key: any
        switch: boolean | ISignal<boolean> // Safari-only for now
        $value: ISignal<any>
        $checked: ISignal<boolean>
        $selected: ISignal<boolean>
      }>,
    {}
  >
} = new Proxy({} as any, {
  get(target, key: any) {
    if (!(key in target)) {
      target[key] = createElement(String(key).toLowerCase())
    }
    return target[key]
  },
})

function createElement<P = any, M = {}>(
  tag: string,
  classNames: string[] = [],
  modifiers?: ModifierBuilder<M>
): ElementBuilder<P, M> {
  const elementFn = Object.assign(
    function Element(props?: P, children?: Children) {
      return element(tag, props, children, classNames, modifiers)
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
        cssOrModifiers: string | ModifierBuilder<N>,
        newModifiers?: ModifierBuilder<N>
      ): ElementBuilder<P, M & N> & Designable<M & N> {
        const cssString =
          typeof cssOrModifiers === "string" ? cssOrModifiers : undefined
        const modifiersFn: ModifierBuilder<N> =
          typeof cssOrModifiers === "function" ? cssOrModifiers : newModifiers!
        let extraClasses: string[] = []

        if (cssString) {
          const cssClass = withAutoScope(() => cssTemplate([cssString] as any))
          extraClasses.push(cssClass)
        }

        const combinedModifiers: ModifierBuilder<M & N> = (
          baseModifiers,
          context
        ) => {
          const prev = modifiers ? modifiers(baseModifiers, context) : ({} as M)
          const next = modifiersFn
            ? modifiersFn(baseModifiers, context)
            : ({} as N)
          const merged = { ...prev, ...next } as M & N
          // return merged
          // update merged to support chaining...
          return Object.keys(merged as any).reduce((modifiers: any, key) => {
            modifiers[key] = (...args: any[]) => {
              ;(merged as any)[key](...args)
              return merged
            }
            return modifiers
          }, {} as M & N) // How do I get these types to merge properly for chaining? Or do I do that at the createElement level?
        }

        return createElement<P, M & N>(
          tag,
          [...extraClasses, ...classNames],
          combinedModifiers
        )
      },
    } as Designable<M>
  ) as ElementBuilder<P, M>
  return elementFn
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

function element<P, M>(
  name: string,
  props: any = EMPTY_PROPS,
  children: Children = EMPTY_CHILDREN,
  customClasses: string[] = [],
  customModifiers?: ModifierBuilder<M>
): ElementModifiers<M> {
  // const activeView = View.active
  const el = document.createElement(name)

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
      el.addEventListener(key.slice(2).toLowerCase(), props[key])
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
          else config.verbose && console.warn("No active view to dispose")
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

  if (customClasses.length)
    customClasses.forEach((cls) => el.classList.add(cls))

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
      config.verbose && console.error("Invalid children", result)
    }
  })

  let modifiers: BaseModifiers = createBaseModifiers(el)

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
  return chainableModifiers as ElementModifiers<M>
}

function createBaseModifiers(el: HTMLElement) {
  const modifiers = {
    classNames: (...args: any[]) => {
      const classes = classNames(...args)
      el.classList.add(classes)
      return modifiers
    },
    style: (styles: string | Partial<CSSStyleDeclaration>) => {
      if (typeof styles === "string") {
        const currentStyles = el.getAttribute("style") || ""
        el.style.cssText = currentStyles + styles
      } else {
        for (const key in styles) {
          //@ts-ignore
          el.style[key] = styles[key]
        }
      }
      return modifiers
    },
    transitionName(name: string) {
      //@ts-ignore
      el.style.viewTransitionName = name
      return modifiers
    },
    // css: (styles: TemplateStringsArray | string, ...args: any[]) => {
    //   const src = typeof styles === "string" ? [styles] : styles
    //   const css = withAutoScope(() => cssTemplate(src as any, ...args))
    //   el.classList.add(css)
    //   return modifiers
    // },
  }
  return modifiers
}

function setElAttr(el: Element, key: string, value: any) {
  if (isSignal(value)) {
    const disposeLiveAttr = effect(() => {
      el.setAttribute(key, String(value.value))
    })
    View.active?.hooks.onDispose(disposeLiveAttr)
  } else {
    el.setAttribute(key, String(value))
  }
}
function setElProp(el: Element, key: string, value: any) {
  if (isSignal(value)) {
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

function createRenderMarkers(id: string) {
  const startMarker = document.createComment(id)
  const endMarker = document.createComment(`/${id}`)
  return { startMarker, endMarker }
}

function insertBetweenMarkers(node: Node, start: Comment, end: Comment) {
  if (end.parentNode) {
    end.parentNode.insertBefore(node, end)
  }
}

function removeBetweenMarkers(start: Comment, end: Comment) {
  if (start.isConnected) {
    const range = document.createRange()
    range.setStartAfter(start)
    range.setEndBefore(end)
    range.deleteContents()
  }
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

function makeChainable<T extends object>(obj: T): Chainable<T> {
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
type ReactiveCallback<T> = (unwrappedValue: T) => void

function bindValue<T>(
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
function bindEvent(
  element: HTMLElement,
  event: keyof HTMLElementEventMap,
  callback: (e: HTMLElementEventMap[typeof event]) => void
): () => void {
  element.addEventListener(event, callback)
  return () => element.removeEventListener(event, callback)
}
