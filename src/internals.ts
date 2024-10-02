export type EffectFunction = () => void | (() => void)
export type EffectErrorFunction = (error: any, source?: Computation) => void

let idPrefix: string | null = null
let lastId = 0

export let config = {
  verbose: false,
}

export const setVerbose = (value: boolean) => {
  config.verbose = value
}

/**
 * Represents a readonly signal that holds a value of type `T`.
 * Provides methods to get the current value, peek at the value without triggering
 * reactivity, and subscribe to changes in the value.
 *
 * @template T - The type of the value held by the signal.
 */
export interface ISignal<T> {
  readonly value: T
  get(): T
  peek(): T
  subscribe(run: (value: T) => void): () => void
}

/**
 * Represents a mutable signal that holds a value of type `T`.
 * Provides methods to get, set, and update the value.
 *
 * @template T - The type of the value held by the signal.
 */
export interface IMutableSignal<T> extends ISignal<T> {
  get value(): T
  set value(newValue: T)
  set(newValue: T): void
  update(updater: (value: T) => T): void
}

/**
 * *Use the `signal` function to create a new signal.*
 *
 * The `Signal` class represents a reactive value that can be observed for changes.
 * It implements the `IMutableSignal` interface and provides methods to get, set,
 * and update the value, as well as to subscribe to changes.
 *
 * @template T - The type of the value held by the signal.
 */
export class Signal<T> implements IMutableSignal<T> {
  readonly id = !!idPrefix
    ? `${idPrefix}.${(lastId++).toString(36)}`
    : (lastId++).toString(36)

  private _value: T
  private _subscriptions = event<T>()
  dependents: Set<Computation> = new Set()

  constructor(value: T) {
    this._value = value
  }

  get value(): T {
    if (Computation.current) {
      this.dependents.add(Computation.current)
      Computation.current.dependencies.add(this)
    }
    return this._value
  }

  set value(newValue: T) {
    if (this._value !== newValue) {
      this._value = newValue
      const dependents = Array.from(this.dependents)
      dependents.forEach((dep) => dep.invalidate())
      this._subscriptions.send(newValue)
    }
  }

  peek(): T {
    return this._value
  }
  get() {
    return this.value
  }
  set(newValue: T) {
    this.value = newValue
  }
  update(updater: (value: T) => T) {
    const newValue = updater(this._value)
    this.set(newValue)
  }

  // Add the subscribe method to conform to Svelte's store interface
  subscribe(run: (value: T) => void): () => void {
    run(this._value)
    return this._subscriptions(run)
  }
}

/**
 * Use this function to run a block of code with a specific id, which can be useful
 * for debugging and logging. It will use the specified id for the duration of the
 * block and then revert to the previous id. Any signals or computeds created within
 * the block will use the specified id.
 *
 * @param id - The id to use for the block of code.
 * @param worker - The function to run with the specified id.
 * @template T - The return type of the worker function.
 * @returns The result of the worker function.
 *
 * @usage
 *
 * ```ts
 * const authState = withIdPrefix("auth-state", () => signal("initial value"))
 * ```
 */
export function withIdPrefix<T>(id: string, worker: () => T) {
  const prevIdPrefix = idPrefix
  idPrefix = id
  try {
    return worker()
  } finally {
    idPrefix = prevIdPrefix
  }
}

/**
 * *Use the `effect` function to create a new computation effect.*
 *
 * Represents a computation that runs an effect function and tracks its dependencies.
 */
export class Computation {
  readonly id = !!idPrefix
    ? `${idPrefix}.${(lastId++).toString(36)}`
    : (lastId++).toString(36)

  fn: EffectFunction
  dependencies: Set<Signal<any>> = new Set()
  private _isRunning: boolean = false
  private _isCleaning: boolean = false
  private _fnCleanup: (() => void) | void = void 0
  onInvalidate: (() => void) | null = null
  parentComputation: Computation | null
  childComputations: Set<Computation> = new Set()
  errorFn: EffectErrorFunction

  constructor(
    fn: EffectFunction,
    parentComputation: Computation | null = null,
    onError?: EffectErrorFunction
  ) {
    this.fn = fn
    this.parentComputation = parentComputation
    this.errorFn = onError || Computation.globalErrorHandler
    this.run()
  }

  run() {
    if (this._isRunning) {
      return
    }
    this.cleanup(false)
    Computation.stack.push(this)
    Computation.current = this
    try {
      this._isRunning = true
      const result = this.fn()

      if (typeof result === "function") {
        this._fnCleanup = result
      } else {
        this._fnCleanup = void 0
      }
    } catch (error) {
      let exceptionHandled = false
      if (this.errorFn) {
        try {
          this.errorFn(error, this)
          exceptionHandled = this.errorFn !== Computation.globalErrorHandler
        } catch (error) {
          config.verbose && console.error("Error in error handler", error)
        }
      }
      if (!exceptionHandled) {
        this.cleanup()
      }
    } finally {
      this._isRunning = false
      Computation.stack.pop()
      Computation.current =
        Computation.stack[Computation.stack.length - 1] || null
    }
  }

  invalidate() {
    if (Computation.isBatching) {
      Computation.pending.add(this)
    } else if (this.onInvalidate) {
      this.onInvalidate()
    } else {
      this.run()
    }
  }

  cleanup(clearFromParent = true) {
    if (this._isCleaning) {
      return
    }
    this._isCleaning = true

    Array.from(this.childComputations).forEach((child) => {
      child.cleanup()
    })

    if (this._fnCleanup) {
      try {
        this._fnCleanup()
        this._fnCleanup = void 0
      } catch (error) {
        config.verbose && console.error("Cleanup Error:", error)
      }
    }
    this.dependencies.forEach((dep) => dep.dependents.delete(this))
    this.dependencies.clear()

    if (this.parentComputation && clearFromParent) {
      this.parentComputation.childComputations.delete(this)
    }
    this._isCleaning = false
  }

  protected static globalErrorHandler = (error: any, source?: Computation) => {
    config.verbose && console.error("Unhandled Computation Error:", error)
  }
  static setGlobalErrorHandler(handler: (error: any) => void) {
    Computation.globalErrorHandler = handler
  }

  static current: Computation | null = null
  static isBatching = false
  static stack: Computation[] = []
  static pending = new Set<Computation>()
}

/**
 * *Use the `computed` function to create a new computed signal.*
 *
 * Represents a computed signal that derives its value from a function.
 */
export class ComputedSignal<T> implements ISignal<T> {
  readonly id = !!idPrefix
    ? `${idPrefix}.${(lastId++).toString(36)}`
    : (lastId++).toString(36)

  private _signal: Signal<T>
  private _isEvaluated: boolean = false
  private parentComputation: Computation | null = null
  cleanup?: () => void

  constructor(
    protected fn: () => T,
    protected onError?: EffectErrorFunction,
    protected lazy = true
  ) {
    this._signal = new Signal<T>(undefined as any)
    this.parentComputation = Computation.current
    if (!lazy) {
      this._evaluate()
    }
  }

  get value(): T {
    return this.get()
  }

  peek(): T {
    this._evaluate()
    return this._signal.peek()
  }

  get() {
    this._evaluate()
    return this._signal.get()
  }

  subscribe(run: (value: T) => void): () => void {
    this._evaluate()
    return this._signal.subscribe(run)
  }

  private _evaluate() {
    if (this._isEvaluated) return
    // This is basically the same as `effect()`, but it injects
    // a specific computation as the parent computation.
    const computation = new Computation(
      () => {
        this._signal.value = this.fn()
      },
      this.parentComputation,
      this.onError
    )
    if (this.parentComputation) {
      this.parentComputation.childComputations.add(computation)
    }
    this.cleanup = () => computation.cleanup()
    this._isEvaluated = true
  }
}

/**
 * Creates a new signal with the specified value.
 *
 * @param value - The initial value of the signal.
 * @template T - The type of the value held by the signal.
 * @returns A new signal with the specified value.
 *
 * @usage
 * ```ts
 * const mySignal = signal(42)
 *
 * console.log(mySignal.get()) // or mySignal.value
 * // => 42
 * mySignal.set(100)
 * mySignal.update((value) => value + 1)
 * mySignal.subscribe((value) => console.log("Signal updated:", value))
 * // => Signal updated: 101
 * mySignal.peek() // untracked value access
 * ```
 */
export function signal<T>(value: T): IMutableSignal<T> {
  return new Signal(value)
}

/**
 * Creates a new computation effect and returns a cleanup function.
 *
 * @param fn - The effect function to be executed.
 * @param onError - Optional callback to handle errors that occur during the execution of the effect function.
 * @returns A function that, when called, cleans up the computation effect.
 *
 * @usage
 * ```ts
 * const unsubscribe = effect(() => {
 *   const value = mySignal.value
 *   // do something with the value, will re-run when mySignal changes
 * })
 * ```
 */
export function effect(
  fn: EffectFunction,
  onError?: (error: any) => void
): () => void {
  const parentComputation = Computation.current
  const computation = new Computation(fn, parentComputation, onError)
  if (parentComputation) {
    parentComputation.childComputations.add(computation)
  }
  return () => computation.cleanup?.()
}

/**
 * Runs the specified function without tracking dependencies.
 *
 * @param fn - The function to run without tracking dependencies.
 */
export function untracked(fn: () => void) {
  const prevComputation = Computation.current
  Computation.current = null
  try {
    fn()
  } catch (error) {
    config.verbose && console.error("Error in untracked", error)
    throw error
  } finally {
    Computation.current = prevComputation
  }
}

/**
 * Creates a new computed signal that derives its value from the specified function.
 *
 * @param fn - The function to derive the value of the computed signal.
 * @param onError - Optional callback to handle errors that occur during the computation.
 * @param type - The type of the computed signal. "eager" will compute the value immediately, "lazy" will compute the value on first access. Default: "lazy"
 * @returns A new computed signal.
 *
 * @usage
 * ```ts
 * const myComputed = computed(() => {
 *   return mySignal.value * 2 // will re-compute when mySignal changes
 * })
 * mySignal.set(50)
 * console.log(myComputed.get())
 * // => 100
 * ```
 */
export function computed<T>(
  fn: () => T,
  onError?: (error: any) => void,
  type: "eager" | "lazy" = "lazy"
): ISignal<T> {
  //& { invalidate: () => void } {
  return new ComputedSignal(fn, onError, type === "lazy")
}

/**
 * Runs the specified function and batches any updates that occur within it.
 *
 * @param fn - The function to run within a batch.
 *
 * @usage
 * ```ts
 * batch(() => {
 *  mySignalA.set(42)
 *  mySignalB.set(100)
 * })
 * // Both updates will be batched and only trigger one reactivity update.
 */
export function batch(fn: () => void) {
  const prevBatching = Computation.isBatching
  Computation.isBatching = true
  try {
    fn()
  } finally {
    Computation.isBatching = prevBatching
    if (!Computation.isBatching) {
      const computationsToRun = Array.from(Computation.pending)
      Computation.pending.clear()
      computationsToRun.forEach((comp) => comp.run())
    }
  }
}

/**
 * Checks if the specified signal is a signal.
 *
 * @param signal - The signal to check.
 * @returns `true` if the signal is a readonly signal, otherwise `false`.
 */
export function isSignal<T>(signal: any): signal is ISignal<T> {
  return (
    typeof signal === "object" &&
    signal !== null &&
    "get" in signal &&
    "peek" in signal &&
    "subscribe" in signal
  )
}

/**
 * Checks if the specified signal is a mutable signal.
 * @param signal - The signal to check.
 * @returns `true` if the signal is a mutable signal, otherwise `false`.
 */
export function isMutableSignal<T>(signal: any): signal is IMutableSignal<T> {
  return isSignal(signal) && "set" in signal && "update" in signal
}

type EventCallback<T> = (detail: T) => void

export interface SparkEvent<T> {
  (callback: EventCallback<T>): () => void
  send(detail: T): void
  clear(): void
}

/**
 * Creates a new event that can be subscribed to and triggered.
 *
 * @returns A new event object.
 *
 * @usage
 * ```ts
 * const myEvent = event<number>()
 *
 * const unsubscribe = myEvent((value) => {
 *  console.log("Event received:", value)
 * })
 *
 * myEvent.send(42)
 * // => Event received: 42
 * ```
 */
export function event<T>(): SparkEvent<T> {
  let targets: Set<EventCallback<T>> | null = null

  function subscribe(callback: EventCallback<T>): () => void {
    if (!targets) {
      targets = new Set<EventCallback<T>>()
    }
    targets.add(callback)
    return () => targets?.delete(callback)
  }
  function send(detail: T): void {
    targets?.forEach((callback) => {
      try {
        callback(detail)
      } catch (error) {
        config.verbose && console.error("Error in event callback", error)
      }
    })
  }
  function clear(): void {
    targets?.clear()
    targets = null
  }
  return Object.assign(subscribe, { send, clear })
}
