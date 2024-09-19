type EffectFunction = () => void | (() => void);
interface ReadonlySignal<T> {
    readonly value: T;
    get(): T;
    peek(): T;
    subscribe(run: (value: T) => void): () => void;
}
declare class Signal<T> implements ReadonlySignal<T> {
    private _value;
    private subscribers?;
    dependents: Set<Computation>;
    constructor(value: T);
    get value(): T;
    set value(newValue: T);
    peek(): T;
    get(): T;
    set(newValue: T): void;
    update(updater: (value: T) => T): void;
    subscribe(run: (value: T) => void): () => void;
}
declare class Computation {
    static lastId: number;
    readonly id: number;
    fn: EffectFunction;
    dependencies: Set<Signal<any>>;
    private isRunning;
    private isCleaning;
    onInnerCleanup: (() => void) | void;
    onInvalidate: (() => void) | null;
    parentComputation: Computation | null;
    childComputations: Set<Computation>;
    constructor(fn: EffectFunction, parentComputation?: Computation | null);
    run(): void;
    invalidate(): void;
    cleanup(clearFromParent?: boolean): void;
    static current: Computation | null;
    static stack: Computation[];
    static isBatching: boolean;
    static pending: Set<Computation>;
}
declare function signal<T>(value: T): Signal<T>;
declare function effect(fn: EffectFunction): () => void;
declare function computed<T>(fn: () => T): ReadonlySignal<T>;
declare function batch(fn: () => void): void;

export { Signal, batch, computed, effect, signal };
