# Pulse

> Microscopic signals with automatic dependency tracking.

Pulse signals are straightforward containers for values—no magic, no proxies, no weird tricks. They hold anything you throw at them: scalars, objects, DOM elements, functions, classes, instances... Whatever.

No need to worry about tracking dependencies in your computed values or effects—Pulse handles that automatically.

<small>Minify+gzips to < 2kB for core+utils.</small>

At its core it's a simple API:

```ts
declare function signal<T>(intialValue: T): Signal<T>
declare function computed<T>(worker: () => T): Computed<T>
declare function effect(worker: () => void): Effect
declare function batch(worker: () => void): void

declare class Signal<T> {
  readonly id: string
  peek(): T
  get: () => T
  set(newValue: T, forceNotify?: boolean): boolean
  subscribe(listener: (newValue: T) => void): Effect
  dispose: () => void
}
declare class Computed<T> {
  readonly id: string
  peek(): T
  get: () => T
  subscribe(listener: (newValue: T) => void): Effect
  dispose: () => void
}
declare class Effect {
  readonly id: string
  dispose: () => void
}
```

## Usage

```ts
import { signal, computed, effect } from "@elucidata/pulse"

const counter = signal(0)
const doubled = computed(() => counter.get() * 2)

effect(() => {
  console.log("Counter:", counter.get(), "doubled:", doubled.get())
})

counter.set(1)
```

## Installation

No dependencies or prerequisites other than a JS runtime. Bun is used for development.
To install _pulse_:

```
bun install github:elucidata/pulse
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

Updates a signal with a new value or partial value. If a function is provided as the updater, it receives the current value and should return the updated value. If an object is provided, it will be merged with the current value. When reportChanges is set to true, the function returns an array of keys that were changed

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
