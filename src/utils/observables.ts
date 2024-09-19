import { Signal, signal } from "../internals"

// Hot and Lazy Sync Observables with map and filter
export interface Observable<T> {
  subscribe(run: (value: T) => void): () => void
  map<U>(mapFn: (value: T) => U): Observable<U>
  filter(predicate: (value: T) => boolean): Observable<T>
  toSignal(): Signal<T>
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
export function observable<T>(
  setup: (emit: (value: T) => void) => () => void
): Observable<T> {
  let subscribers = 0
  let teardown: (() => void) | null = null
  const s = signal<T | undefined>(undefined)

  return {
    map<U>(mapFn: (value: T) => U): Observable<U> {
      return map(this, mapFn)
    },
    filter(predicate: (value: T) => boolean): Observable<T> {
      return filter(this, predicate)
    },
    subscribe(run) {
      subscribers++
      if (subscribers === 1) {
        teardown = setup((value) => {
          s.set(value)
        })
      }

      const subscription = s.subscribe((value) => {
        if (value !== undefined) run(value)
      })

      return () => {
        subscription()
        subscribers--
        if (subscribers === 0 && teardown) {
          teardown()
          teardown = null
          s.set(undefined)
        }
      }
    },
    toSignal() {
      return s as Signal<T>
    },
  }
}

/**
 * Creates an observable from a DOM event.
 *
 * @template K - The type of the event name, which must be a key of `HTMLElementEventMap`.
 * @param {HTMLElement} element - The DOM element to listen for events on.
 * @param {K} eventName - The name of the event to listen for.
 * @returns {Observable<HTMLElementEventMap[K]>} An observable that emits events of the specified type.
 */
export function fromDomEvent<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  eventName: K
): Observable<HTMLElementEventMap[K]> {
  return observable<HTMLElementEventMap[K]>((emit) => {
    const handler = (event: HTMLElementEventMap[K]) => emit(event)
    element.addEventListener(eventName, handler)

    return () => {
      element.removeEventListener(eventName, handler)
    }
  })
}

export function map<T, U>(
  source: Observable<T>,
  mapFn: (value: T) => U
): Observable<U> {
  return observable<U>((emit) => {
    const teardown = source.subscribe((value) => {
      emit(mapFn(value))
    })
    return teardown
  })
}

export function filter<T>(
  source: Observable<T>,
  predicate: (value: T) => boolean
): Observable<T> {
  return observable<T>((emit) => {
    const teardown = source.subscribe((value) => {
      if (predicate(value)) emit(value)
    })
    return teardown
  })
}
