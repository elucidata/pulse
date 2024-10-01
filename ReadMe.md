# Pulse

> Microscopic signals with automatic dependency tracking.

Pulse signals are straightforward containers for values—no magic, no proxies, no weird tricks. They hold anything you throw at them: scalars, objects, DOM elements, functions, classes, instances... Whatever.

No need to worry about tracking dependencies in your computed values or effects—Pulse handles that automatically.

At its core it's a simple API:

```ts
declare function signal<T>(value: T): Signal<T>;
declare function effect(fn: EffectFunction): () => void;
declare function computed<T>(fn: () => T): ReadonlySignal<T>;
declare function batch(fn: () => void): void;

type EffectFunction = () => void | (() => void);

interface ReadonlySignal<T> {
    readonly value: T;
    get(): T;
    peek(): T;
    subscribe(run: (value: T) => void): () => void;
}
declare class Signal<T> implements ReadonlySignal<T> {
    constructor(value: T);
    get value(): T;
    set value(newValue: T);
    set(newValue: T): void;
    update(updater: (value: T) => T): void;
}
```

## Usage

```ts
import { signal, computed, effect } from "@elucidata/pulse"

const counter = signal(0)
const doubled = computed(() => counter.get() * 2)

effect(() => {
  // Use can use .get() or .value
  console.log("Counter:", counter.value, "doubled:", doubled.value)
})

counter.set(1)
// or counter.value = 1
// or counter.update(c => c + 1)
```

## Installation

No dependencies or prerequisites other than a JS runtime. Bun is used for development.

To install _pulse_:

```
bun install @elucidata/pulse
```

## React/Preact

There are two ways to react to signal changes: Using a higher-order function, or a hook.

Higher-order function:

```tsx
import { signal } from "@elucidata/pulse"
import { observer } from "@elucidata/pulse/react"

const counter = signal(1)

const ExampleView = observer((props) => {
  return <div>{counter.value}</div>
})
```

Hook:

```tsx
import { signal } from "@elucidata/pulse"
import { useComputed } from "@elucidata/pulse/react"

const counter = signal(1)

const ExampleView = (props) => {
  const count = useComputed(() => counter.value)

  return <div>{count}</div>
}
```

### Local State

While not recommended, you _could_ do something like this:

```tsx
import { signal } from "@elucidata/pulse"
import { useComputed } from "@elucidata/pulse/react"
import { useEffect, useMemo } from "react"

const ExampleView = (props) => {
  const counter = useMemo(() => signal(1), [])
  const count = useComputed(() => counter.value)

  useEffect(() => {
    const interval = setInterval(() => {
      counter.update((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return <div>{count}</div>
}
```

## Svelte

Signals comply with Svelte's store contract:

```html
<script>
  import { signal } from "@elucidata/pulse"

  const counter = signal(1)
</script>

<div>{$counter}</div>
```

## PulseView (Experimental)

Included is a tiny experimental view engine you can play with... Feedback welcome. Pulse View is a declarative statement-based, reactive UI toolkit.

- No virtual DOM. Live DOM nodes are created and deleted by builders. 
- Updates are reactions to signal values only. 
- Sections of a view can be reactive when denoted with `when`, `each`, or `live`.
  
### The Tao of PulseView

Pulse View is guided by a set of high-level principles:

1. **Dynamic View Management**: Views in Pulse View are dynamically built and removed as needed.

2. **Signal-Driven Updates**: All updates within Pulse View are driven by signal reactions. 

3. **Modularity and Reusability**: Components within Pulse View are designed to be modular and reusable. 

4. **Performance Optimization**: Pulse View is optimized for performance, ensuring that even with dynamic view management and signal-driven updates, the application remains fast and responsive.

  
### Demo Usage

```ts
import { view, signal, render, tags, text } from '@elucidata/pulse/view';

const { div, button } = tags;

const counter = signal(0);

const CounterView = view(() => {
    div(() => {
        button({ onClick: () => counter.value++ }, 'Increment');
        button({ onClick: () => counter.value-- }, 'Decrement');
        div(() => {
            text('Count: ')
            text(counter)
        });
    });
});

const dispose = render(CounterView(), document.getElementById('app'))
```

## Utilities

### `persistedSignal`

```ts
declare function persistedSignal<T>(
  key: string,
  initialValue: T,
  options?: Partial<PersistedSignalOptions<T>>
): Signal<T>

interface PersistedSignalOptions<T> {
  storage: IStorage // defaults to globalThis.localStorage
  toStorage: (value: T) => string // defaults to JSON.stringify
  fromStorage: (value: string) => T // defaults to JSON.parse
}

interface IStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
```

Creates a signal that persists its value in storage (using localStorage by default). The value is serialized to a string before being stored and deserialized when retrieved. If storage is unavailable, a regular signal will be returned instead.

### `update`

```ts
declare function update<T>(
  state: Signal<T>,
  updater: Merger<T> | Updater<T>,
  reportChanges?: boolean
): boolean | (keyof T)[]

type Merger<T> = Partial<T> | ((v: T) => Partial<T>)
type Updater<T> = Required<T> | ((v: T) => T)
```

Updates a signal with a new value or partial value. If a function is provided as the updater, it receives the current value and should return the updated value. If an object is returned, it will be merged with the current value. When reportChanges is set to true, the function returns an array of keys that were changed

## How is this different than (fill in the blank)

KISS. Keep It Simple, Signals. Think of it like nanostores but with automatic dependency tracking. If you need fancier signals implementations check out:

- Preact Signals
- MobX
- SolidJS

## Contributing

We will happily review contributions from the community. To be eligible for merging into _pulse_, please follow these guidelines and project goals:

- Keep it simple
- Keep it small
- Keep it fast
- Err on the side of less code

## License

_Pulse_ is licensed under the [MIT License](License.md).
