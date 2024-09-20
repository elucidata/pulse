import { signal } from "../internals";
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
export function observable(setup) {
    let subscribers = 0;
    let teardown = null;
    const s = signal(undefined);
    return {
        get value() {
            return s.value;
        },
        peek() {
            return s.peek();
        },
        get() {
            return s.get();
        },
        map(mapFn) {
            return map(this, mapFn);
        },
        filter(predicate) {
            return filter(this, predicate);
        },
        subscribe(run) {
            subscribers++;
            if (subscribers === 1) {
                teardown = setup((value) => {
                    s.set(value);
                });
            }
            const subscription = s.subscribe((value) => {
                if (value !== undefined)
                    run(value);
            });
            return () => {
                subscription();
                subscribers--;
                if (subscribers === 0 && teardown) {
                    teardown();
                    teardown = null;
                    s.set(undefined);
                }
            };
        },
    };
}
/**
 * Creates an observable from a DOM event.
 *
 * @template K - The type of the event name, which must be a key of `HTMLElementEventMap`.
 * @param {HTMLElement} element - The DOM element to listen for events on.
 * @param {K} eventName - The name of the event to listen for.
 * @returns {Observable<HTMLElementEventMap[K]>} An observable that emits events
 *  of the specified type.
 */
export function fromDomEvent(element, eventName) {
    return observable((emit) => {
        const handler = (event) => emit(event);
        element.addEventListener(eventName, handler);
        return () => {
            element.removeEventListener(eventName, handler);
        };
    });
}
export function map(source, mapFn) {
    return observable((emit) => {
        const teardown = source.subscribe((value) => {
            emit(mapFn(value));
        });
        return teardown;
    });
}
export function filter(source, predicate) {
    return observable((emit) => {
        const teardown = source.subscribe((value) => {
            if (predicate(value))
                emit(value);
        });
        return teardown;
    });
}
//# sourceMappingURL=observables.js.map