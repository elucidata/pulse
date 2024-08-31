import { Signal } from './index.js';
export { Computed, Effect, batch, computed, config, devTools, dispose, effect, isComputed, isEffect, isSignal, signal, withIdPrefix } from './index.js';

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

export { Signal, persistedSignal, update };
