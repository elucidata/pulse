export type EffectFunction = () => void | (() => void)

export interface ReadonlySignal<T> {
  readonly value: T
  get(): T
  peek(): T
  subscribe(run: (value: T) => void): () => void
}

export class Signal<T> implements ReadonlySignal<T> {
  private _value: T
  private subscribers?: Set<(value: T) => void>
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
      this.subscribers?.forEach((subscriber) => subscriber(newValue))
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
    this.set(updater(this._value))
  }

  // Add the subscribe method to conform to Svelte's store interface
  subscribe(run: (value: T) => void): () => void {
    run(this._value)
    if (!this.subscribers) {
      this.subscribers = new Set()
    }
    this.subscribers.add(run)

    return () => {
      this.subscribers!.delete(run)
    }
  }
}

export class Computation {
  static lastId = 0

  readonly id = Computation.lastId++
  fn: EffectFunction
  dependencies: Set<Signal<any>> = new Set()
  private isRunning: boolean = false
  private isCleaning: boolean = false
  onInnerCleanup: (() => void) | void = void 0
  onInvalidate: (() => void) | null = null
  parentComputation: Computation | null
  childComputations: Set<Computation> = new Set()

  constructor(
    fn: EffectFunction,
    parentComputation: Computation | null = null
  ) {
    this.fn = fn
    this.parentComputation = parentComputation
    this.run()
  }

  run() {
    if (this.isRunning) {
      return
    }
    this.cleanup(false)
    Computation.stack.push(this)
    Computation.current = this
    try {
      this.isRunning = true
      const result = this.fn()

      if (typeof result === "function") {
        this.onInnerCleanup = result
      } else {
        this.onInnerCleanup = void 0
      }
    } finally {
      this.isRunning = false
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
    if (this.isCleaning) {
      return
    }
    this.isCleaning = true

    Array.from(this.childComputations).forEach((child) => {
      child.cleanup()
    })
    // this.childComputations.clear()

    if (this.onInnerCleanup) {
      this.onInnerCleanup()
      this.onInnerCleanup = void 0
    }
    this.dependencies.forEach((dep) => dep.dependents.delete(this))
    this.dependencies.clear()

    if (this.parentComputation && clearFromParent) {
      this.parentComputation.childComputations.delete(this)
    }
    this.isCleaning = false
  }

  static current: Computation | null = null
  static stack: Computation[] = []
  static isBatching = false
  static pending = new Set<Computation>()
}

export class ComputedSignal<T> implements ReadonlySignal<T> {
  private signal: Signal<T>
  cleanup: () => void

  constructor(fn: () => T) {
    this.signal = new Signal<T>(undefined as any)
    this.cleanup = effect(() => {
      this.signal.value = fn()
    })
  }

  get value(): T {
    return this.signal.value
  }

  peek(): T {
    return this.signal.peek()
  }

  get() {
    return this.signal.get()
  }

  subscribe(run: (value: T) => void): () => void {
    return this.signal.subscribe(run)
  }
}

export function signal<T>(value: T): Signal<T> {
  return new Signal(value)
}

export function effect(fn: EffectFunction): () => void {
  const parentComputation = Computation.current
  const computation = new Computation(fn, parentComputation)
  if (parentComputation) {
    parentComputation.childComputations.add(computation)
  }
  return () => computation.cleanup()
}

export function computed<T>(fn: () => T): ReadonlySignal<T> {
  return new ComputedSignal(fn)
}

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

export function isObservable(value: any): boolean {
  return typeof signal === "object" && signal !== null && "get" in signal
}

export function isReadonlySignal<T>(signal: any): signal is ReadonlySignal<T> {
  return (
    typeof signal === "object" &&
    signal !== null &&
    "get" in signal &&
    "peek" in signal &&
    "subscribe" in signal
  )
}
