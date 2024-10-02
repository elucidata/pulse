# Pulse

> Microscopic signals with automatic dependency tracking.

Pulse signals are straightforward containers for values—no magic, no proxies, no weird tricks. They hold anything you throw at them: scalars, objects, DOM elements, functions, classes, instances... Whatever.

No need to worry about tracking dependencies in your computed values or effects—Pulse handles that automatically.

At its core, it's a simple API:

```ts
function signal<T>(value: T): IMutableSignal<T>;
function effect(fn: EffectFunction, onError?: ErrorCallback): CleanupFunction;
function computed<T>(fn: () => T): ISignal<T>;
function batch(fn: () => void): void;

type EffectFunction = () => void | (() => void);
type CleanupFunction = () => void;
type ErrorCallback = (error: any, source: any) => void;

interface ISignal<T> {
    readonly value: T;
    get(): T;
    peek(): T;
    subscribe(run: (value: T) => void): CleanupFunction;
}

interface IMutableSignal<T> extends ISignal<T> {
    get value(): T;
    set value(newValue: T);
    set(newValue: T): void;
    update(updater: (value: T) => T): void;
}
```

## Usage

```ts
import { signal, computed, effect } from "@elucidata/pulse";

const counter = signal(0);
const doubled = computed(() => counter.get() * 2);

effect(() => {
  // You can use .get() or .value
  console.log("Counter:", counter.value, "Doubled:", doubled.value);
});

counter.set(1);
// or counter.value = 1
// or counter.update(c => c + 1);
```

## Installation

Pulse has no dependencies or prerequisites other than a JavaScript runtime. Bun is used for development.

To install Pulse:

```
bun add @elucidata/pulse
```

## React/Preact

There are two ways to react to signal changes: using a higher-order function or a hook.

### Higher-Order Function

```tsx
import { signal } from "@elucidata/pulse";
import { observer } from "@elucidata/pulse/react";

const counter = signal(1);

const ExampleView = observer((props) => {
  return <div>{counter.value}</div>;
});
```

### Hook

```tsx
import { signal } from "@elucidata/pulse";
import { useComputed } from "@elucidata/pulse/react";

const counter = signal(1);

const ExampleView = (props) => {
  const count = useComputed(() => counter.value);

  return <div>{count}</div>;
};
```

### Local State

While not recommended, you _could_ do something like this:

```tsx
import { signal } from "@elucidata/pulse";
import { useComputed } from "@elucidata/pulse/react";
import { useEffect, useMemo } from "react";

const ExampleView = (props) => {
  const counter = useMemo(() => signal(1), []);
  const count = useComputed(() => counter.value);

  useEffect(() => {
    const interval = setInterval(() => {
      counter.update((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return <div>{count}</div>;
};
```

## Svelte

Signals comply with Svelte's store contract:

```svelte
<script>
  import { signal } from "@elucidata/pulse";

  const counter = signal(1);
</script>

<div>{$counter}</div>
```

## Pulse View (Experimental)

Included is a tiny experimental view engine you can play with. Feedback is welcome. Pulse View is a declarative, statement-based, reactive UI toolkit.

- **No Virtual DOM**: Live DOM nodes are created and deleted by builders.
- **Signal-Driven Updates**: Updates are reactions to signal values only.
- **Reactive Sections**: Parts of a view can be reactive when denoted with `when`, `each`, or `live`.

### The Tao of Pulse View

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
    Root(() => {
        Button('Increment', () => counter.value++);
        Button('Decrement', () => counter.value--);

        div(() => {
            text('Count: ');
            text(counter);
        });
    });
});

const Root = div.design.css`
  padding: 1rem;
  border: 0.1rem solid dodgerblue;
`;

const Button = (children, onclick) => {
  button({ onclick }, children);
};

const dispose = render(CounterView(), document.getElementById('app'));
```

## Utilities

### `persistedSignal`

```ts
declare function persistedSignal<T>(
  key: string,
  initialValue: T,
  options?: Partial<PersistedSignalOptions<T>>
): Signal<T>;

interface PersistedSignalOptions<T> {
  storage: IStorage; // Defaults to globalThis.localStorage
  toStorage: (value: T) => string; // Defaults to JSON.stringify
  fromStorage: (value: string) => T; // Defaults to JSON.parse
}

interface IStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
```

Creates a signal that persists its value in storage (using `localStorage` by default). The value is serialized to a string before being stored and deserialized when retrieved. If storage is unavailable, a regular signal will be returned instead.

### `update`

```ts
declare function update<T>(
  state: Signal<T>,
  updater: Merger<T> | Updater<T>,
  reportChanges?: boolean
): boolean | (keyof T)[];

type Merger<T> = Partial<T> | ((v: T) => Partial<T>);
type Updater<T> = Required<T> | ((v: T) => T);
```

Updates a signal with a new value or partial value. If a function is provided as the updater, it receives the current value and should return the updated value. If an object is returned, it will be merged with the current value. When `reportChanges` is set to `true`, the function returns an array of keys that were changed.

## How Is This Different Than Others?

**KISS** — Keep It Simple, Signals. Think of it like nanostores but with automatic dependency tracking. If you need more advanced signal implementations, check out:

- **Preact Signals**
- **MobX**
- **SolidJS**

## Contributing

We happily review contributions from the community. To be eligible for merging into Pulse, please follow these guidelines and project goals:

- **Keep It Simple**
- **Keep It Small**
- **Keep It Fast**
- **Err on the Side of Less Code**

## License

_Pulse_ is licensed under the [MIT License](License.md).
