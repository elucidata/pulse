import { Signal } from "../internals";
export type Updater<T> = Required<T> | ((v: T) => T);
export type Merger<T> = Partial<T> | ((v: T) => Partial<T>);
/**
 * Update a signal with a new value or partial value.
 * If the updater is a function, it will receive the current value and should return the new value.
 * If the updater is an object, it will be merged with the current value.
 * If reportChanges is true, it will return an array of changed keys.
 *
 */
export declare function update<T>(state: Signal<T>, updater: Updater<T> | Merger<T>, reportChanges?: boolean): void | (keyof T)[];
