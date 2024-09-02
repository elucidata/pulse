declare let mode: "debug" | "production";
type Debuggable = Signal<any> | Computed<any> | Effect;
declare function config(options: {
    mode: typeof mode;
}): void;
/** This will only be populated if mode == "debug". */
declare const devTools: {
    byId: Map<string, Signal<any> | Computed<any> | Effect>;
    gc: {
        /** Number of objects in memory */
        readonly alive: number;
        /** Number of objects that are not disposed  */
        readonly active: number;
        created: number;
        disposed: number;
        finalized: number;
        watcher: FinalizationRegistry<unknown>;
    };
    track(target: Debuggable): void;
    untrack(target: Debuggable): void;
};
declare function withIdPrefix<T>(prefix: string, worker: () => T): T;
declare const isSignal: <T>(value: T | Signal<T>) => value is Signal<T>;
declare const isComputed: <T>(value: T | Computed<T>) => value is Computed<T>;
declare const isEffect: <T>(value: T | Effect) => value is Effect;
interface Disposable {
    dispose(): void;
}
declare function dispose(...targets: Disposable[]): void;
type Speaker = Signal<any> | Computed<any>;
type Listener = Computed<any> | Effect;
declare class Signal<T> {
    readonly id: string;
    protected _value: T;
    protected _listeners: Set<Listener>;
    constructor(initialValue: T);
    peek(): T;
    get: () => T;
    set(newValue: T, forceNotify?: boolean): boolean;
    subscribe(listener: (newValue: T) => void): Effect;
    dispose: () => void;
    protected _notify: () => void;
    /** @protected @deprecated For internal use */
    static internals(signal: Signal<any>): {
        signal: Signal<any>;
        _value: any;
        _listeners: Set<Listener>;
    };
}
declare class Computed<T> {
    protected _fn: () => T;
    readonly id: string;
    protected _value: T;
    protected _isStale: boolean;
    protected _signals: Set<Speaker>;
    protected _listeners: Set<Listener>;
    constructor(_fn: () => T);
    peek(): T;
    get: () => T;
    subscribe(subscriber: (newValue: T) => void): Effect;
    dispose: () => void;
    protected _derive(): void;
    protected _notify(): void;
    /** @protected @deprecated For internal use */
    static internals(computed: Computed<any>): {
        computed: Computed<any>;
        _value: any;
        _isStale: boolean;
        _signals: Set<Speaker>;
        _listeners: Set<Listener>;
    };
}
declare class Effect {
    protected _fn: () => void | (() => void);
    readonly id: string;
    protected _signals: Set<Speaker>;
    protected _isStale: boolean;
    protected _isDisposed: boolean;
    protected _dispose: () => void;
    constructor(_fn: () => void | (() => void));
    protected _run: () => void;
    protected _notify(): undefined;
    dispose: () => void;
    /** @protected @deprecated For internal use */
    static internals(effect: Effect): {
        effect: Effect;
        _signals: Set<Speaker>;
        _isStale: boolean;
        _isDisposed: boolean;
        _innerDispose: () => void;
    };
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
declare function batch(worker: () => void): void;
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
declare function signal<T>(initialValue: T): Signal<T>;
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
declare function computed<T>(computeFn: () => T): Computed<T>;
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
declare function effect(worker: () => void | (() => void)): Effect;

export { Computed, Effect, Signal, batch, computed, config, devTools, dispose, effect, isComputed, isEffect, isSignal, signal, withIdPrefix };
