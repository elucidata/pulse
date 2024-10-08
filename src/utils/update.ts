import { IMutableSignal } from "../internals"

export type Updater<T> = Required<T> | ((v: T) => T)
export type Merger<T> = Partial<T> | ((v: T) => Partial<T>)

/**
 * Update a signal with a new value or partial value.
 * If the updater is a function, it will receive the current value and should return the new value.
 * If the updater is an object, it will be merged with the current value.
 * If reportChanges is true, it will return an array of changed keys.
 *
 */
export function update<T>(
  state: IMutableSignal<T>,
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
