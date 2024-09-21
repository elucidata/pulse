# In The Future...

Just to be clear, these features aren't implemented yet... But I'm considering them.


## Flow Components

Some common helper components that could be included by default.

```ts
declare function For(
  props: ForProps, 
  children: [(item: any, i:number) => Node]
): Node | Node[]
declare type ForProps = {
  each: any[] | ReadonlySignal<any[]>
  fallback?: ComponentFunction | Node 
}

declare function Show(
    props: ShowProps,
    children: any
): Node | Node[]
declare type ShowProps = {
  when: boolean | Signal<boolean>
  fallback?: ComponentFunction | Node 
}
```


## CSS Var Attributes

Pass CSS variables as attributes...
  
```js
const MyView => () =>
  html`<div class="Card" --padding="0"> ... </div>`
```

## Promises and Signals or Observables

Create some kind of AsyncSignal that wraps a Promise and updates when the promise resolves/rejects.

- Look into Solid's `resource` and how it works. 

Using signals for all these promised-based values, we should be able to avoid the need for Suspense support.

```js
const App = () => {
  const list = asyncSignal(() => fetch("/todos"))
  
  if (list.loading.value) return html`<p>Loading...</p>`

  return html`
    <div>
      <${For} each=${list}>
        ${(item) => h(ItemView, { item })}
      <//>
    </div>
  `
}
```

- Does it make more sense to wrap a Promise in an Observable instead of a Signal?


## Scoped CSS Widgets

```jsx
const View = () => html`
  <${Root} cssFlags=${{ isLoading: loadingSignal }}>
    <${Show} when=${loadingSignal}>
      <p>Loading...</p>
    <//>
    <div class="nested">
      Hello there.
    </div>
  <//>
`

const ViewJSX = () => (
  <Root cssFlags={{ isLoading: loadingSignal }}>
    <Show when={loadingSignal}>
      <p>Loading...</p>
    </Show>
    <div class="nested">
      Hello there.
    </div>
  </Root>
)

const Root = widget.div.View.css`
  padding: 1rem;

  &.isLoading {
    color: red;
  }

  .nested {
    padding: 1rem;
    border-left: .25rem solid silver;
  }
`
```


## Integrated View Transitions

Automatic view transition support. Whenever a (named?) change occurs, wrap changes in a startViewTransition scope automatically.

- Is it global?
  - If not, how do I opt-in for some components/elements?
- Should PV create transition names automatically?
- How do I specify a (custom) view transition name?

```js
const LiveView = () =>
  html`<div :view="--stuff-view"> Stuff </div>`
```
