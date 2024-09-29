<!-- Describe how Pulse/View works. -->

I'm considering a refactor of my TypeScript 

This is the Pulse signals library, written, tested, and known to work. Supports nested Computations (effects) that support returning a cleanup (invalidate) function. 

Here are the interfaces for that module:

```ts
export type EffectFunction = () => void | (() => void);
export interface ReadonlySignal<T> {
    readonly value: T;
    get(): T;
    peek(): T;
    subscribe(run: (value: T) => void): () => void;
}
export declare class Signal<T> implements ReadonlySignal<T> {
    private _value;
    private _subscribers?;
    dependents: Set<Computation>;
    constructor(value: T);
    get value(): T;
    set value(newValue: T);
    peek(): T;
    get(): T;
    set(newValue: T): void;
    update(updater: (value: T) => T): void;
    subscribe(run: (value: T) => void): () => void;
}
export declare class Computation {
    static lastId: number;
    readonly id: number;
    fn: EffectFunction;
    dependencies: Set<Signal<any>>;
    private _isRunning;
    private _isCleaning;
    private _fnCleanup;
    onInvalidate: (() => void) | null;
    parentComputation: Computation | null;
    childComputations: Set<Computation>;
    constructor(fn: EffectFunction, parentComputation?: Computation | null);
    run(): void;
    invalidate(): void;
    cleanup(clearFromParent?: boolean): void;
    static current: Computation | null;
    static stack: Computation[];
    static isBatching: boolean;
    static pending: Set<Computation>;
}
export declare class ComputedSignal<T> implements ReadonlySignal<T> {
    private _signal;
    readonly cleanup: () => void;
    constructor(fn: () => T);
    get value(): T;
    peek(): T;
    get(): T;
    subscribe(run: (value: T) => void): () => void;
}
export declare function signal<T>(value: T): Signal<T>;
export declare function effect(fn: EffectFunction): () => void;
export declare function computed<T>(fn: () => T): ReadonlySignal<T>;
export declare function batch(fn: () => void): void;
export declare function isObservable(value: any): boolean;
export declare function isReadonlySignal<T>(signal: any): signal is ReadonlySignal<T>;
```

# Current View Architecture...

The `.d.ts` for reference of general design.

```ts
export declare const contextStack: Map<any, any>[];
export declare function setContext(key: any, value: any): void;
export declare function getContext<T>(key: any): T;
export declare const cleanupStack: (() => void)[][];
export declare function onMount(fn: () => void | (() => void)): void;
export declare function onUnmount(fn: () => void): void;
export declare function h(tag: string | ComponentFunction, props: Props | null, ...children: any[]): Node;
export declare function appendChild(parent: Node, child: any, disposes?: (() => void)[]): void;
export declare function createComponent(component: ComponentFunction, props: any, children: any[]): {
    node: Node;
    dispose: () => void;
};
export declare function render(component: ComponentFunction, container: HTMLElement): () => void;
```


# New View Architecture Ideas...

- Combine the notion of a `RenderContext` with a `ComponentInstance` and create a `View` (a component instance tree structure) that encapsulates the context and lifecycles hooks. Each `render` call creates a new `View` and assembles the two resulting trees: `DOM` and `Components`.

  - `createComponent` takes the component and props and returns `{ node, view }` and appends the node to the target `HTMLElement` and returns a disposer function.

  - To dispose of the render tree, the render disposer will call `view.dispose()` and maybe a few root level clean up concerns.

  - The `h`, `appendChild`, `setContext`, and `getContext` (and possibly other) functions will use a static `View.current` reference for runtime context.

  - An `action` should associate itself with `View.current` so it can be cleaned up with the component is disposed.


Pseudo-code:

```ts
class View {
  id: string = uid()
  children: ViewTree[] = []

  context?: Map<string, any>
  disposers?: Set<DisposerFn>

  component: ComponentFunction
  props: Record<string, Signal<any>>
  children: any //?
  node: Node

  constructor(
    public parent:ViewTree | null
  ) {}

  dispose() {
    Array.from(this.children).forEach(child => child.dispose())
    this.disposers?.forEach(dispose => dispose())
    this.context?.clear()
    this.disposers?.clear()
    this.parent?.children.splice(this.parent.children.indexOf(this), 1)
    console.assert(
      this.children.length === 0,
      "Component still has children after disposal"
    )
  }

  static current: View | null = null

  static withNewChild<T>((worker: (child: View) => T){
    const parent = View.current
    const child = new View(parent)
    View.current = child
    const result = worker(child)
    View.current = parent
    return result
  }
}

```

## View Stacks?

Example usage:

```ts
import { view, tags, designer, when, slot, list, css, signal, effect, hasChildren } from '@elucidata/pulse/view`

const { A, Div, Section, Main, Header, H1, Button. Aside } = tags

const Page = view(() => {

  const counter = signal(0)
  const increment = () => signal.value++

  Header(() => {
    H1("Hello There")
  })

  Section({class:'counter'}, () => {
    P(() => {
      text("Counter: ")
      text(signal)
    })
    Button({ onclick: increment }, () => "Increment")
  })

  QuipPanel({ username:'matt' })

})
.styles(/*css*/`
  color: dimgrey;
  font-family: var(--stack-modern);

  .counter {
    background: silver;
    border-radius: 1rem;
    padding: 1rem;
  }
`)


const QuipPanel = view((props, children, { onDispose }) => {
  const loading = signal(true)
  const error = signal(null)
  cosnt items = signal([])
  const abort = new AbortController()

  fetch(`/users/${props.username}`, { signal: abort })
    .then(r => r.json())
    .then(data => items.set(data))
    .catch(err => error.set(err))
    .finally(() => loading.set(false))

  onDispose(() => {
    // this component is being removed from the Dom...
    abort.abort()
  })


  Aside(() => {
    Header(() => {
      when(loading, () => {
        text("Loading...")
      }, () => {
        text(items?.length ?? 0 +" Quips")
      })
    })
    when(() => error.value !== null, ()=> {
      ErrorMessage(() => {
        text("There was an error loading quips: ")
        text(error)
      })
    })
    Div({ class: 'QuipList' }, () => {
      list(() => {
        items.forEach(item => {
          // Each call under a list is a new row
          HStack(() => 
            VStack(() => {
              H3(() => item.title)
              P(item.body)
            })
          }).key(item.id)
        })
      })
    })
  })

  when(() => hasChildren(children), () => {
    Message(() => children()))
  }) 
}).styles(/*css*/`
  .QuipList {}
`)

const Message = Div.design.css`
  padding: 1rem;
  background: dodgerblue;
  color: white;
`
const ErrorMessage = Message.design.css`
  background: crimson;
`
const HStack = Div.design.css`
  display: flex;
`
const Spacer =  Div.design.css`
  flex: 1;
`
```

- Should there be a top-level `app` builder that manages an environment map that all components within can access? Or would it make sense for each component to reference their parent's `env` and the root component of a render becomes the owner of the `env`?
  - Note: This isn't a `Context` in the React sense. It's data associated with an entire render tree, not just sections of it. It's also a shared pool (literally a Map) of data, it's not a prototype chain, entries can't be masked.

```ts
const App = app(({ setEnv }, params) => {
  setEnv("mode", params.mode || "debug")
  Page()
})

const Page = view(() => {
  const mode = getEnv("mode")

  if(mode == "debug") console.log("I'm in debug mode.")

  div("hello")
})

// Third param is an optional params object to send to the app 
const dispose = render(App(), document.getElementById('root'), {
  mode: 'production'
})
```

This could be done using existing `view` design.

```ts
const App = view((params, children) => {
  setEnv("mode", params.mode || "debug")
  Page()
})

const Page = view(() => {
  const mode = getEnv("mode")

  if(mode == "debug") console.log("I'm in debug mode.")

  div("hello")
})
 
const dispose = render(
  App({ mode: 'production' }), 
  document.getElementById('root')
)
```