const NOOP = () => {}
const IsDisposed = Symbol("pulse(disposed)")
const effectQueue = new Set<() => void>()
const batchedUpdateQueue = new Set<Function>()

let idPrefx = ""
let inBatch = false
let lastUid = Date.now()
let mode = "production" as "debug" | "production"

type Debuggable = Signal<any> | Computed<any> | Effect

export function config(options: { mode: typeof mode }) {
  mode = options.mode
}

class MockFinalizationRegistry {
  constructor(public callback: Function) {}
  register(obj: any, held: any) {}
  unregister(held: any) {}
}

const GCWatch = globalThis.FinalizationRegistry || MockFinalizationRegistry

/** This will only be populated if mode == "debug". */
export const devTools = {
  byId: new Map<string, Speaker | Listener>(),
  gc: {
    /** Number of objects in memory */
    get alive() {
      return devTools.gc.created - devTools.gc.finalized
    },
    /** Number of objects that are not disposed  */
    get active() {
      return devTools.gc.created - devTools.gc.disposed
    },
    created: 0,
    disposed: 0,
    finalized: 0,
    watcher: new GCWatch((id) => {
      devTools.gc.finalized = devTools.gc.finalized + 1
      // console.debug("🧹 GC Finalized", id)
    }),
  },
  track(target: Debuggable) {
    if (mode !== "debug") return
    devTools.byId.set(target.id, target as any)
    devTools.gc.watcher.register(target, target.id)
    devTools.gc.created = devTools.gc.created + 1
  },
  untrack(target: Debuggable) {
    if (mode !== "debug") return
    devTools.byId.delete(target.id)
    devTools.gc.disposed = devTools.gc.disposed + 1
    if (devTools.gc.watcher instanceof MockFinalizationRegistry) {
      devTools.gc.watcher.callback(target.id)
    }
  },
}

export function withIdPrefix<T>(prefix: string, worker: () => T): T {
  const previousPrefix = idPrefx
  idPrefx = prefix + "_"
  const result = worker()
  idPrefx = previousPrefix
  return result
}

export function uid() {
  return (lastUid++).toString(36)
}

export const isSignal = <T>(value: T | Signal<T>): value is Signal<T> =>
  value instanceof Signal

export const isComputed = <T>(value: T | Computed<T>): value is Computed<T> =>
  value instanceof Computed

export const isEffect = <T>(value: T | Effect): value is Effect =>
  value instanceof Effect

function _executeEffects() {
  effectQueue.forEach((effect) => {
    effect()
  })
  effectQueue.clear()
}

function _executeQueuedUpdates() {
  batchedUpdateQueue.forEach((notifyDependents) => {
    notifyDependents()
  })
  batchedUpdateQueue.clear()
}

interface Disposable {
  dispose(): void
}

export function dispose(...targets: Disposable[]) {
  targets.forEach((target) => {
    if ("dispose" in target) {
      target.dispose()
    } else {
      console.error("Cannot dispose", target)
    }
  })
}

type Speaker = Signal<any> | Computed<any>
type Listener = Computed<any> | Effect

export class TrackingContext {
  constructor(
    public readonly listener: Listener,
    public readonly callback: () => void
  ) {}

  static current: TrackingContext | null = null

  static run(listener: Listener, callback: () => void) {
    const context = new TrackingContext(listener, callback)
    const previousContext = TrackingContext.current
    TrackingContext.current = context
    callback()
    TrackingContext.current = previousContext
  }
}

function trackSignal(listener: Listener, signal: Speaker) {
  ;(listener as any)._signals.add(signal)
}
function untrackSignal(
  listener: Listener,
  signal: Speaker,
  fromDispose = false
) {
  ;(listener as any)._signals.delete(signal)
  if (fromDispose) {
    // console.debug(" 💥 Computed auto-dispose", this.id)
    listener.dispose()
  }
}

function trackListener(signal: Speaker, listener: Listener) {
  ;(signal as any)._listeners.add(listener)
}
function untrackListener(
  signal: Speaker,
  listener: Listener,
  fromDispose?: boolean
) {
  ;(signal as any)._listeners.delete(listener)
}
function signalChanged(listener: Listener) {
  ;(listener as any)._notify()
}

export class Signal<T> {
  readonly id = idPrefx + "S" + uid()

  protected _value: T
  protected _listeners = new Set<Listener>()

  constructor(initialValue: T) {
    this._value = initialValue
    devTools.track(this)
  }

  peek() {
    return this._value
  }

  get = () => {
    if (this._value === IsDisposed) {
      throw new Error("Signal is disposed")
    }
    if (TrackingContext.current) {
      trackListener(this, TrackingContext.current.listener)
      trackSignal(TrackingContext.current.listener, this)
    }
    return this._value
  }

  set(newValue: T, forceNotify = false) {
    if (this._value !== newValue || forceNotify) {
      this._value = newValue

      if (this._value === IsDisposed) {
        this._listeners.forEach((listener) => {
          untrackSignal(listener, this, true)
        })
        this._listeners.clear()
        devTools.untrack(this)
        return false
      }

      if (inBatch) {
        batchedUpdateQueue.add(this._notify)
      } else {
        this._notify()
        _executeEffects()
      }
      return true
    }
    return false
  }

  subscribe(listener: (newValue: T) => void) {
    return new Effect(() => {
      listener(this.get())
    })
  }

  dispose = (): void => {
    if (this._value === IsDisposed) return //console.warn("Signal dispose skipped due to previous disposal")

    this.set(IsDisposed as T)
  }

  protected _notify = () => {
    this._listeners.forEach((listener) => {
      signalChanged(listener) //, this)
    })
  }

  /** @protected @deprecated For internal use */
  static internals(signal: Signal<any>) {
    return {
      signal,
      _value: signal._value,
      _listeners: signal._listeners,
    }
  }
}

export class Computed<T> {
  readonly id = idPrefx + "C" + uid()

  protected _value!: T
  protected _isStale = true

  protected _signals = new Set<Speaker>()
  protected _listeners = new Set<Listener>()

  constructor(protected _fn: () => T) {
    devTools.track(this)
  }

  peek() {
    return this._value
  }

  get = () => {
    if (this._value === IsDisposed) {
      throw new Error("Computed is disposed")
    }
    if (this._isStale) {
      this._signals.forEach((signal) => {
        untrackListener(signal, this)
      })
      this._signals.clear()
      if (TrackingContext.current) {
        trackListener(this, TrackingContext.current.listener)
        trackSignal(TrackingContext.current.listener, this)
      }
      TrackingContext.run(this as any, () => {
        this._derive()
      })
    }
    return this._value
  }

  subscribe(subscriber: (newValue: T) => void) {
    return new Effect(() => {
      subscriber(this.get())
    })
  }

  dispose = () => {
    if (this._value === IsDisposed) return //console.warn("Computed dispose skipped due to previous disposal")

    this._listeners.forEach((listener) => {
      untrackSignal(listener, this, true)
    })
    this._listeners.clear()
    this._signals.forEach((speaker) => {
      untrackListener(speaker, this, true)
    })
    this._signals.clear()
    this._value = IsDisposed as T
    devTools.untrack(this)
  }

  protected _derive() {
    this._value = this._fn()
    this._isStale = false
  }

  protected _notify() {
    if (!this._isStale) {
      this._isStale = true
      this._listeners.forEach((listener) => {
        signalChanged(listener) //, this)
      })
    }
  }

  /** @protected @deprecated For internal use */
  static internals(computed: Computed<any>) {
    return {
      computed,
      _value: computed._value,
      _isStale: computed._isStale,
      _signals: computed._signals,
      _listeners: computed._listeners,
    }
  }
}

export class Effect {
  readonly id = idPrefx + "E" + uid()

  protected _signals = new Set<Speaker>()
  protected _isStale = true
  protected _isDisposed = false
  // If the effect returns a dispose function, it will be called when the effect is disposed
  protected _dispose: () => void = NOOP

  constructor(protected _fn: () => void | (() => void)) {
    devTools.track(this)
    this._run()
  }

  protected _run = () => {
    if (this._isDisposed)
      return console.warn("Effect run skipped due to disposed")
    if (this._isStale) {
      this._signals.forEach((signal) => {
        untrackListener(signal, this)
      })
      this._signals.clear()
      TrackingContext.run(this as any, () => {
        this._dispose = this._fn() || this._dispose
      })
    }
    this._isStale = false
    return void 0
  }

  protected _notify() {
    if (this._isDisposed) return //console.warn("Effect rerun skipped due to disposed")
    if (!this._isStale) {
      this._isStale = true
      effectQueue.add(this._run)
    }
    return void 0
  }

  dispose = () => {
    if (this._isDisposed) return //console.warn("Effect dispose skipped due to previous disposal")
    this._isDisposed = true
    this._dispose()
    this._signals.forEach((speaker) => {
      untrackListener(speaker, this, true)
    })
    this._signals.clear()
    devTools.untrack(this)
  }

  /** @protected @deprecated For internal use */
  static internals(effect: Effect) {
    return {
      effect,
      _signals: effect._signals,
      _isStale: effect._isStale,
      _isDisposed: effect._isDisposed,
      _innerDispose: effect._dispose,
    }
  }
}

/**
 * Run a function in a batch, which will delay the updates and effects until the batch is finished.
 *
 * @param worker A function that will be executed in a batch.
 * @example
 *  batch(() => {
 *    counter.set(10)
 *    counter.set(20)
 *  }) // Only one update and effect will be executed
 */
export function batch(worker: () => void) {
  inBatch = true
  try {
    return worker()
  } finally {
    inBatch = false
    _executeQueuedUpdates()
    _executeEffects()
  }
}

/**
 * Create a signal with an initial value, which can be read and updated.
 *
 * @param initialValue The initial value of the signal.
 * @returns A signal object.
 * @example
 *  const counter = signal(0)
 *  console.log(counter.get()) // 0
 *  counter.set(10)
 *  console.log(counter.get()) // 10
 */
export function signal<T>(initialValue: T) {
  return new Signal(initialValue)
}

/**
 * Derive a signal from one or more signals, which will automatically update when the dependencies change.
 *
 * @param computeFn A function that computes the value of the signal.
 * @returns A signal object.
 * @example
 *  const counter = signal(0)
 *  const double = computed(() => counter.get() * 2)
 *  console.log(double.get()) // 0
 *  counter.set(10)
 *  console.log(double.get()) // 20
 */
export function computed<T>(computeFn: () => T) {
  return new Computed(computeFn)
}

/**
 * Automatically run a function when its dependencies change.
 *
 * @param worker A function that will be executed when its dependencies change.
 * @returns A function to dispose the effect.
 * @example
 *  const counter = signal(0)
 *  effect(() => {
 *    console.log("Counter changed:", counter.get())
 *  })
 *  counter.set(10) // Logs "Counter changed: 10"
 *  counter.set(20) // Logs "Counter changed: 20"
 */
export function effect(worker: () => void | (() => void)) {
  return new Effect(worker)
}

//@ts-ignore
globalThis._pulse_ = {
  devTools,
  internals: {
    effectQueue,
    batchedUpdateQueue,
    get inBatch() {
      return inBatch
    },
    get lastUid() {
      return lastUid
    },
    get _idPrefx() {
      return idPrefx
    },
  },
  dispose,
  Signal,
  Computed,
  Effect,
  batch,
  signal,
  computed,
  effect,
}
