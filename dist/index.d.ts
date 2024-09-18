type EffectFunction = () => void;
interface ReadonlySignal<T> {
    readonly value: T;
    get(): T;
    peek(): T;
    subscribe(run: (value: T) => void): () => void;
}
declare class Signal<T> implements ReadonlySignal<T> {
    private _value;
    private subscribers;
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
    fn: EffectFunction;
    dependencies: Set<Signal<any>>;
    private isRunning;
    onInvalidate: (() => void) | null;
    constructor(fn: EffectFunction);
    run(): void;
    invalidate(): void;
    cleanup(): void;
}
declare function signal<T>(value: T): Signal<T>;
declare function effect(fn: EffectFunction): void;
declare function computed<T>(fn: () => T): ReadonlySignal<T>;
declare function batch(fn: () => void): void;

export { Signal, batch, computed, effect, signal };
