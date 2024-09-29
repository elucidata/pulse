# In The Future...

Just to be clear, these features aren't implemented yet... But I'm considering them.


## CSS classnames with proxies?

```ts
const MyView = view((props) => {
    div.Card(() => {
        div.CardHeader(() => props.header)
        // etc. and so on...
    })
}).styles(/* css */`
    .Card {
        .CardHeader {
        }
    }
`)
```

## CSS Var Attributes

Pass CSS variables as attributes...
  
```js
const MyView => view(() =>
    div({ class:'Card', '--padding': 0 }, "...")
)
```

- How would this work in (T|J)SX?


## Promises and Signals or Observables

Create some kind of AsyncSignal that wraps a Promise and updates when the promise resolves/rejects.

- Look into Solid's `resource` and how it works. 

Using signals for all these promised-based values, we should be able to avoid the need for Suspense support.

```js
const App = view(() => {
    const list = asyncSignal(() => fetch("/todos"))

    when(list.loading, () => {
        p("Loading...)
    }, () => {
        div(() => {
            list.value.map(item => {
                ItemView({ item })
            })
        })
    })
})

const ItemView = view({ item }, ()=> {
    /// etch...
})
```

- Does it make more sense to wrap a Promise in an Observable instead of a Signal?


## WebComponents

- Helper function to take a Pulse View and turn it into a Web Component.


## Integrated View Transitions

Automatic view transition support. Whenever a (named?) change occurs, wrap changes in a startViewTransition scope automatically.

- Is it global?
  - If not, how do I opt-in for some components/elements?
- Should Pulse create transition names automatically?
- How do I specify a (custom) view transition name?

## Notes About Pulse View TNG

### New View Architecture Ideas...

-   Combine the notion of a `RenderContext` with a `ComponentInstance` and create a `View` (a component instance tree structure) that encapsulates the context and lifecycles hooks. Each `render` call creates a new `View` and assembles the two resulting trees: `DOM` and `Components`.

    -   `createComponent` takes the component and props and returns `{ node, view }` and appends the node to the target `HTMLElement` and returns a disposer function.

    -   To dispose of the render tree, the render disposer will call `view.dispose()` and maybe a few root level clean up concerns.

    -   The `h`, `appendChild`, `setContext`, and `getContext` (and possibly other) functions will use a static `View.current` reference for runtime context.

    -   An `action` should associate itself with `View.current` so it can be cleaned up with the component is disposed.

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

-   Should there be a top-level `app` builder that manages an environment map that all components within can access? Or would it make sense for each component to reference their parent's `env` and the root component of a render becomes the owner of the `env`?
    -   Note: This isn't a `Context` in the React sense. It's data associated with an entire render tree, not just sections of it. It's also a shared pool (literally a Map) of data, it's not a prototype chain, entries can't be masked.

```ts
const App = app(({ setEnv }, params) => {
    setEnv("mode", params.mode || "debug")
    Page()
})

const Page = view(() => {
    const mode = getEnv("mode")

    if (mode == "debug") console.log("I'm in debug mode.")

    div("hello")
})

// Third param is an optional params object to send to the app
const dispose = render(App(), document.getElementById("root"), {
    mode: "production",
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

    if (mode == "debug") console.log("I'm in debug mode.")

    div("hello")
})

const dispose = render(
    App({ mode: "production" }),
    document.getElementById("root")
)
```

Should the View return the builder function?


```ts
const { div, header, main, section } = tags

const getFlash = () => getEnv("flashMessage")
const setFlash = (message) => setEnv("flashMessage", message)

const App = view((props, children) => {
    setFlash(null)

    return () => {
        Page({name: 'User' }, () => {
            div("content")
        })
    }
})

const Page = view((props, children) => {

    return () => main(() => {
        header(`Hello: ${props.name}`)
        
        when(() => !!getFlash().value, () => {
            Banner(() => getFlash().value)
        })

        section({class: 'body'}, () => {
            children()
        })
    })
}).style(/*css*/`
    .body { padding: 1rem; }
`)

const Banner = div.design.css`
    background: dodgerblue;
    color: white;
    padding: 1rem;
    border-radius: .5rem;
`
```