import { ISignal, signal } from "../internals"

// Hot and Lazy Sync Observables with map and filter, masquerading as a ISignal
export interface Observable<T> extends ISignal<T> {
  subscribe(run: (value: T) => void): () => void
  map<U>(mapFn: (value: T) => U): Observable<U>
  filter(predicate: (value: T) => boolean): Observable<T>
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
export function observable<T>(
  setup: (emit: (value: T) => void) => () => void
): Observable<T> {
  const id = Math.random().toString(36).slice(2)
  let subscribers = 0
  let teardown: (() => void) | null = null
  const s = signal<T>(undefined as any)

  return {
    get id() {
      return id
    },
    get value() {
      return s.value
    },
    peek() {
      return s.peek()
    },
    get() {
      return s.get()
    },
    map<U>(mapFn: (value: T) => U): Observable<U> {
      return map(this, mapFn)
    },
    filter(predicate: (value: T) => boolean): Observable<T> {
      return filter(this, predicate)
    },
    subscribe(run) {
      subscribers++
      if (subscribers === 1) {
        try {
          teardown = setup((value) => {
            s.set(value)
          })
        } catch (e) {
          console.error("Error in observable setup", e)
        }
      }

      const unsubscribe = s.subscribe((value) => {
        if (value !== undefined) run(value)
      })

      return () => {
        unsubscribe()
        subscribers--
        if (subscribers === 0 && teardown) {
          try {
            teardown()
          } catch (e) {
            console.error("Error in observable teardown", e)
          }
          teardown = null
          s.set(undefined as any)
        }
      }
    },
  }
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
