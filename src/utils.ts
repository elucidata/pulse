export * from "./index"

import { effect, Signal, signal } from "./internals"

interface IStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface PersistedSignalOptions<T> {
  storage: IStorage
  toStorage: (value: T) => string
  fromStorage: (value: string) => T
}

const DEFAULT_OPTIONS: PersistedSignalOptions<any> = {
  storage: globalThis.localStorage,
  toStorage: JSON.stringify,
  fromStorage: JSON.parse,
}

/**
 * Create a signal that will persist its value in the storage. (localStorage by default)
 * The value will be serialized to a string before storing.
 * The value will be deserialized when retrieved from the storage.
 * If the storage is not available, it will return a regular signal.
 */
export function persistedSignal<T>(
  key: string,
  initialValue: T,
  options?: Partial<PersistedSignalOptions<T>>
) {
  let { storage, toStorage, fromStorage } = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  if (!storage) {
    // No storage available, return a regular signal
    console.warn("No storage available, using regular signal", key)
    return signal(initialValue)
  }

  let value = storage.getItem(key)
  let sig = signal<T>(value ? fromStorage(value) : initialValue)

  effect(() => {
    const newValue = toStorage(sig.value)
    const oldValue = fromStorage(storage.getItem(key)!)
    if (newValue !== oldValue) {
      storage.setItem(key, newValue)
    }
  })
  return sig
}

type Updater<T> = Required<T> | ((v: T) => T)
type Merger<T> = Partial<T> | ((v: T) => Partial<T>)

/**
 * Update a signal with a new value or partial value.
 * If the updater is a function, it will receive the current value and should return the new value.
 * If the updater is an object, it will be merged with the current value.
 * If reportChanges is true, it will return an array of changed keys.
 *
 */
export function update<T>(
  state: Signal<T>,
  updater: Updater<T> | Merger<T>,
  reportChanges = false
): void | (keyof T)[] {
  const oldState = state.peek()
  const newState = typeof updater === "function" ? updater(oldState) : updater
  const isScalar = typeof newState !== "object" || newState === null
  if (isScalar) {
    return state.set(newState as T)
  } else {
    const updatedState = { ...oldState, ...newState }
    state.set(updatedState)
    return reportChanges ? changedFields(oldState, updatedState) : void 0
  }
}

function changedFields<T extends Record<string | symbol, any>>(
  oldState: T,
  newState: T
): (keyof T)[] {
  let oldKeys = Reflect.ownKeys(oldState)
  let newKeys = Reflect.ownKeys(newState)

  let addedKeys = newKeys.filter((key) => !oldKeys.includes(key))
  let removedKeys = oldKeys.filter((key) => !newKeys.includes(key))
  let changedKeys = oldKeys.filter(
    (key) => oldState[key] !== newState[key]
  ) as (keyof T)[]

  return [...addedKeys, ...removedKeys, ...changedKeys]
}
