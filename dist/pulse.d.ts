declare let mode: "debug" | "production";
type Debuggable = Signal<any> | Computed<any> | Effect;
declare function config(options: {
    mode: typeof mode;
}): void;
/** This will only be populated if mode == "debug". */
declare const devTools: {
    byId: Map<string, Computed<any> | Effect | Signal<any>>;
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

interface IStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
interface PersistedSignalOptions<T> {
    storage: IStorage;
    toStorage: (value: T) => string;
    fromStorage: (value: string) => T;
}
/**
 * Create a signal that will persist its value in the storage. (localStorage by default)
 * The value will be serialized to a string before storing.
 * The value will be deserialized when retrieved from the storage.
 * If the storage is not available, it will return a regular signal.
 */
declare function persistedSignal<T>(key: string, initialValue: T, options?: Partial<PersistedSignalOptions<T>>): Signal<T>;
type Updater<T> = Required<T> | ((v: T) => T);
type Merger<T> = Partial<T> | ((v: T) => Partial<T>);
/**
 * Update a signal with a new value or partial value.
 * If the updater is a function, it will receive the current value and should return the new value.
 * If the updater is an object, it will be merged with the current value.
 * If reportChanges is true, it will return an array of changed keys.
 *
 */
declare function update<T>(state: Signal<T>, updater: Updater<T> | Merger<T>, reportChanges?: boolean): boolean | (keyof T)[];

export { Computed, Effect, Signal, batch, computed, config, devTools, dispose, effect, isComputed, isEffect, isSignal, persistedSignal, signal, update, withIdPrefix };
