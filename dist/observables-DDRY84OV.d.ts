import { Signal } from './index.js';

interface Observable<T> {
    subscribe(run: (value: T) => void): () => void;
    map<U>(mapFn: (value: T) => U): Observable<U>;
    filter(predicate: (value: T) => boolean): Observable<T>;
    toSignal(): Signal<T>;
}
/**
 * Creates an observable that allows subscribing to values and provides methods for mapping and filtering.
 *
 * @template T - The type of the values emitted by the observable.
 * @param {function((value: T) => void): () => void} setup - A function that sets up the observable. It receives an emit function to emit values and returns a teardown function to clean up resources.
 * @returns {Observable<T>} An observable object with methods to map, filter, subscribe, and convert to a signal.
 *
 * @typedef {Object} Observable<T>
 * @property {function((value: T) => U): Observable<U>} map - Maps the values emitted by the observable using the provided mapping function.
 * @property {function((value: T) => boolean): Observable<T>} filter - Filters the values emitted by the observable using the provided predicate function.
 * @property {function((value: T) => void): () => void} subscribe - Subscribes to the observable and runs the provided function when a value is emitted. Returns an unsubscribe function.
 * @property {function(): Signal<T>} toSignal - Converts the observable to a signal.
 */
declare function observable<T>(setup: (emit: (value: T) => void) => () => void): Observable<T>;
/**
 * Creates an observable from a DOM event.
 *
 * @template K - The type of the event name, which must be a key of `HTMLElementEventMap`.
 * @param {HTMLElement} element - The DOM element to listen for events on.
 * @param {K} eventName - The name of the event to listen for.
 * @returns {Observable<HTMLElementEventMap[K]>} An observable that emits events of the specified type.
 */
declare function fromDomEvent<K extends keyof HTMLElementEventMap>(element: HTMLElement, eventName: K): Observable<HTMLElementEventMap[K]>;
declare function map<T, U>(source: Observable<T>, mapFn: (value: T) => U): Observable<U>;
declare function filter<T>(source: Observable<T>, predicate: (value: T) => boolean): Observable<T>;

export { type Observable as O, filter as a, fromDomEvent as f, map as m, observable as o };
