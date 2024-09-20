export type EffectFunction = () => void | (() => void);
export interface ReadonlySignal<T> {
    readonly value: T;
    get(): T;
    peek(): T;
    subscribe(run: (value: T) => void): () => void;
}
export declare class Signal<T> implements ReadonlySignal<T> {
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
export declare class Computation {
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
export declare class ComputedSignal<T> implements ReadonlySignal<T> {
    private signal;
    readonly cleanup: () => void;
    constructor(fn: () => T);
    get value(): T;
    peek(): T;
    get(): T;
    subscribe(run: (value: T) => void): () => void;
}
export declare function signal<T>(value: T): Signal<T>;
export declare function effect(fn: EffectFunction): () => void;
export declare function computed<T>(fn: () => T): ReadonlySignal<T>;
export declare function batch(fn: () => void): void;
export declare function isObservable(value: any): boolean;
export declare function isReadonlySignal<T>(signal: any): signal is ReadonlySignal<T>;
