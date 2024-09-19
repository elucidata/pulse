import { R as ReadonlySignal } from './index-CP5b4Fzw.js';

interface Observable<T> extends ReadonlySignal<T> {
    subscribe(run: (value: T) => void): () => void;
    map<U>(mapFn: (value: T) => U): Observable<U>;
    filter(predicate: (value: T) => boolean): Observable<T>;
}
/**
 * Creates an observable that allows subscribing to values and provides methods for
 * mapping and filtering. The observable is hot and lazy, meaning it will only start
 * emitting values when it has at least one subscriber. When all subscribers unsubscribe,
 * it will stop emitting values. The observable is also synchronous, meaning it will
 * emit values immediately when they are available. The observable is also a signal, so
 * it can be used in place of a signal.
 *
 * @template T - The type of the values emitted by the observable.
 * @param {function((value: T) => void): () => void} setup - A function that sets up the
 *  observable. It receives an emit function to emit values and returns a teardown function
 *  to clean up resources.
 * @returns {Observable<T>} An observable object with methods to map, filter, subscribe,
 *  and convert to a signal.
 */
declare function observable<T>(setup: (emit: (value: T) => void) => () => void): Observable<T>;
/**
 * Creates an observable from a DOM event.
 *
 * @template K - The type of the event name, which must be a key of `HTMLElementEventMap`.
 * @param {HTMLElement} element - The DOM element to listen for events on.
 * @param {K} eventName - The name of the event to listen for.
 * @returns {Observable<HTMLElementEventMap[K]>} An observable that emits events
 *  of the specified type.
 */
declare function fromDomEvent<K extends keyof HTMLElementEventMap>(element: HTMLElement, eventName: K): Observable<HTMLElementEventMap[K]>;
declare function map<T, U>(source: Observable<T>, mapFn: (value: T) => U): Observable<U>;
declare function filter<T>(source: Observable<T>, predicate: (value: T) => boolean): Observable<T>;

export { type Observable as O, filter as a, fromDomEvent as f, map as m, observable as o };
