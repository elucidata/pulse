export * from "./index"

import { Signal, signal } from "./core"

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
): Signal<T> {
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
  let sig = signal(value ? fromStorage(value) : initialValue)
  sig.subscribe((newValue) => {
    storage.setItem(key, toStorage(newValue))
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
): boolean | (keyof T)[] {
  const oldState = state.peek()
  const newState = typeof updater === "function" ? updater(oldState) : updater
  const isScalar = typeof newState !== "object" || newState === null
  if (isScalar) {
    return state.set(newState as T)
  } else {
    const updatedState = { ...oldState, ...newState }
    state.set(updatedState)
    return reportChanges ? changedFields(oldState, updatedState) : true
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

// interface ListMethods<T> {
//   size: () => number
//   add: (value: T | Signal<T>, index?: number) => number
//   remove: (item: Signal<T>) => boolean
//   indexOf: (item: Signal<T>) => number
//   at: (index: number) => Signal<T> | undefined
//   forEach: (cb: (value: Signal<T>, index: number) => void) => void
//   map: <U>(cb: (value: Signal<T>, index: number) => U) => U[]
//   values: () => Signal<T>[]
//   filter: (cb: (value: Signal<T>, index: number) => boolean) => Signal<T>[]
//   clear: () => void
// }

// export type ListSignal<T> = Signal<Signal<T>[]> & ListMethods<T>

// export function list<T = any>(initialValue: T[]): ListSignal<T> {
//   let signalList = signal(
//     initialValue.map((value) =>
//       value instanceof Signal ? value : signal(value)
//     )
//   ) as Signal<Signal<T>[]> & ListMethods<T>

//   Object.assign(signalList, {
//     size() {
//       return signalList.get().length
//     },
//     add(value: T | Signal<T>, index?: number) {
//       let signalArray = signalList.peek()
//       let signalItem: Signal<T> = isSignal(value) ? value : signal(value as T)
//       if (index !== undefined) {
//         signalArray.splice(index, 0, signalItem)
//       } else {
//         signalArray.push(signalItem)
//       }
//       signalList.set([...signalArray], true)
//       return signalArray.length + 1
//     },
//     remove(item: Signal<T>) {
//       let signalArray = signalList.peek()
//       const index = signalArray.findIndex((signal) => signal.id === item.id)
//       let result = signalArray.splice(index, 1)[0]
//       signalList.set([...signalArray], true)
//       return !!result
//     },
//     indexOf(item: Signal<T>) {
//       let signalArray = signalList.peek()
//       return signalArray.findIndex((signal) => signal.id === item.id)
//     },
//     // pop() {
//     //   let signalArray = signalList.peek()
//     //   let result = signalArray.pop()
//     //   signalList.set([...signalArray], true)
//     //   return result
//     // },
//     at(index: number) {
//       let signalArray = signalList.get()
//       return signalArray.at(index)
//     },
//     forEach(cb: (value: Signal<T>, index: number) => void) {
//       signalList.get().forEach(cb)
//     },
//     map<U>(cb: (value: Signal<T>, index: number) => U): U[] {
//       return signalList.get().map(cb)
//     },
//     values() {
//       return signalList.get()
//     },
//     filter(cb: (value: Signal<T>, index: number) => boolean) {
//       return signalList.get().filter(cb)
//     },
//     clear() {
//       signalList.set([])
//     },
//     dispose: () => {
//       // dispose()
//     },
//   } as ListMethods<T>)

//   return signalList
// }

// /**
//  * Creates a signal that will update when keys are added or removed from the object.
//  * Also allows accessing nested fields from the object with dot notation.
//  * (Without the need to get() signal)
//  * Creates a new object with the same keys as the original object, but with the values replaced by signals.
//  * @param obj
//  */
// export function observe<T extends Record<string, any>>(
//   obj: T
// ): { [K in keyof T]: ISignal<T[K]> } {
//   let container = signal({} as T)
//   let signals: { [K in keyof T]: ISignal<T[K]> } = {} as any
//   let keys = Object.keys(obj) as (keyof T)[]
//   keys.forEach((key) => {
//     signals[key] = signal(obj[key])
//   })
//   return signals
// }

// let fieldData = observe({ name: "", age: 0 })
// fieldData.name.subscribe((name) => {
//   console.log("Name changed to:", name)
// })
// fieldData.subscribe((data) => {
//   console.log("Data changed to:", data)
// })
