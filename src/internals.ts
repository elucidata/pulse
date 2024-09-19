type EffectFunction = () => void | (() => void) 

let currentComputation: Computation | null = null

function getCurrentComputation(): Computation | null {
  return currentComputation
}

function setCurrentComputation(comp: Computation | null) {
  currentComputation = comp
}

const computationStack: Computation[] = []

// Batching variables
let isBatching = false
const pendingComputations = new Set<Computation>()

interface ReadonlySignal<T> {
  readonly value: T
  get(): T
  peek(): T
  subscribe(run: (value: T) => void): () => void
}

class Signal<T> implements ReadonlySignal<T> {
  private _value: T
  private subscribers: Set<(value: T) => void> = new Set()
  dependents: Set<Computation> = new Set()

  constructor(value: T) {
    this._value = value
  }

  get value(): T {
    if (currentComputation) {
      this.dependents.add(currentComputation)
      currentComputation.dependencies.add(this)
    }
    return this._value
  }

  set value(newValue: T) {
    if (this._value !== newValue) {
      this._value = newValue
      // Notify dependents
      const dependents = new Set(this.dependents)
      dependents.forEach((dep) => dep.invalidate())
      this.subscribers.forEach((subscriber) => subscriber(newValue))
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
    // Immediately call the subscriber with the current value
    run(this._value)

    // Add the subscriber to the set
    this.subscribers.add(run)

    // Return the unsubscribe function
    return () => {
      this.subscribers.delete(run)
    }
  }
}

class Computation {
  fn: EffectFunction
  dependencies: Set<Signal<any>> = new Set()
  private isRunning: boolean = false
  onInnerCleanup: (() => void) | void = void 0
  onInvalidate: (() => void) | null = null

  constructor(fn: EffectFunction) {
    this.fn = fn
    this.run()
  }

  run() {
    if (this.isRunning) {
      return
    }
    this.isRunning = true
    this.cleanup()
    computationStack.push(this)
    currentComputation = this
    try {
      this.onInnerCleanup = this.fn()
    } finally {
      computationStack.pop()
      currentComputation = computationStack[computationStack.length - 1] || null
      this.isRunning = false
    }
  }

  invalidate() {
    if (isBatching) {
      pendingComputations.add(this)
    } else if (this.onInvalidate) {
      this.onInvalidate()
    } else {
      this.run()
    }
  }

  cleanup() {
    this.onInnerCleanup?.()
    this.onInnerCleanup = void 0
    this.dependencies.forEach((dep) => dep.dependents.delete(this))
    this.dependencies.clear()

  }
}

class ComputedSignal<T> implements ReadonlySignal<T> {
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

function signal<T>(value: T): Signal<T> {
  return new Signal(value)
}

function effect(fn: EffectFunction): () => void {
  const computation = new Computation(fn);
  return () => computation.cleanup();
}

function computed<T>(fn: () => T): ReadonlySignal<T> {
  return new ComputedSignal(fn)
}

function batch(fn: () => void) {
  const prevBatching = isBatching
  isBatching = true
  try {
    fn()
  } finally {
    isBatching = prevBatching
    if (!isBatching) {
      const computationsToRun = Array.from(pendingComputations)
      pendingComputations.clear()
      computationsToRun.forEach((comp) => comp.run())
    }
  }
}

function isObservable(value: any): boolean {
  return typeof signal === "object" && signal !== null && "get" in signal
}

function isReadonlySignal<T>(signal: any): signal is ReadonlySignal<T> {
  return (
    typeof signal === "object" &&
    signal !== null &&
    "get" in signal &&
    "peek" in signal &&
    "subscribe" in signal
  )
}

export {
  Signal,
  ReadonlySignal,
  Computation,
  signal,
  effect,
  computed,
  batch,
  getCurrentComputation,
  setCurrentComputation,
  isReadonlySignal,
  isObservable,
}
