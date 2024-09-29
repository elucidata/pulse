export type EffectFunction = () => void | (() => void)
export type EffectErrorFunction = (error: any, source?: Computation) => void

export interface ReadonlySignal<T> {
    readonly value: T
    get(): T
    peek(): T
    subscribe(run: (value: T) => void): () => void
}

export class Signal<T> implements ReadonlySignal<T> {
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

let overrideId: string | null = null

export function withId<T>(id: string, worker: () => T) {
    const prevId = overrideId
    overrideId = id
    try {
        return worker()
    } finally {
        overrideId = prevId
    }
}

export class Computation {
    protected static lastId = 0

    readonly id = overrideId || (Computation.lastId++).toString(36)
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
                    exceptionHandled =
                        this.errorFn !== Computation.globalErrorHandler
                } catch (error) {
                    console.error("Error in error handler", error)
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
        // this.childComputations.clear()

        // console.debug("Cleaning up", this.id, "deps.size:", this.dependencies.size)

        if (this._fnCleanup) {
            try {
                this._fnCleanup()
                this._fnCleanup = void 0
            } catch (error) {
                // if (typeof error === "object")
                //   Object.assign(error, { computation: this }) // if logged, it'd be a memory leak
                console.error("Cleanup Error:", error)
            }
        }
        this.dependencies.forEach((dep) => dep.dependents.delete(this))
        this.dependencies.clear()

        if (this.parentComputation && clearFromParent) {
            this.parentComputation.childComputations.delete(this)
        }
        this._isCleaning = false
    }

    protected static globalErrorHandler = (
        error: any,
        source?: Computation
    ) => {
        console.error("Unhandled Computation Error:", error)
    }
    static setGlobalErrorHandler(handler: (error: any) => void) {
        Computation.globalErrorHandler = handler
    }

    static current: Computation | null = null
    static isBatching = false
    static stack: Computation[] = []
    static pending = new Set<Computation>()
}

export class ComputedSignal<T> implements ReadonlySignal<T> {
    private _signal: Signal<T>
    readonly cleanup: () => void

    constructor(fn: () => T, onError?: EffectErrorFunction) {
        this._signal = new Signal<T>(undefined as any)
        this.cleanup = effect(() => {
            this._signal.value = fn()
        }, onError)
    }

    get value(): T {
        return this._signal.value
    }

    peek(): T {
        return this._signal.peek()
    }

    get() {
        return this._signal.get()
    }

    subscribe(run: (value: T) => void): () => void {
        return this._signal.subscribe(run)
    }
}

export function signal<T>(value: T): Signal<T> {
    return new Signal(value)
}

export function effect(
    fn: EffectFunction,
    onError?: (error: any) => void
): () => void {
    const parentComputation = Computation.current
    const computation = new Computation(fn, parentComputation, onError)
    if (parentComputation) {
        parentComputation.childComputations.add(computation)
    }
    return () => computation.cleanup()
}

export function untracked(fn: () => void) {
    const prevComputation = Computation.current
    Computation.current = null
    try {
        fn()
    } catch (error) {
        console.error("Error in untracked", error)
        throw error
    } finally {
        Computation.current = prevComputation
    }
}

export function computed<T>(
    fn: () => T,
    onError?: (error: any) => void
): ReadonlySignal<T> {
    return new ComputedSignal(fn, onError)
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

export function isReadonlySignal<T>(signal: any): signal is ReadonlySignal<T> {
    return (
        typeof signal === "object" &&
        signal !== null &&
        "get" in signal &&
        "peek" in signal &&
        "subscribe" in signal
    )
}

type EventCallback<T> = (detail: T) => void

export interface SparkEvent<T> {
    (callback: EventCallback<T>): () => void
    send(detail: T): void
    clear(): void
}

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
                console.error("Error in event callback", error)
            }
        })
    }
    function clear(): void {
        targets?.clear()
        targets = null
    }
    return Object.assign(subscribe, { send, clear })
}
