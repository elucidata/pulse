import { effect, signal } from "../internals"

export interface IStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
}

export interface PersistedSignalOptions<T> {
    storage: IStorage
    toStorage: (value: T) => string
    fromStorage: (value: string) => T
}

const DEFAULT_OPTIONS: PersistedSignalOptions<any> = {
    storage: globalThis.localStorage,
    toStorage: JSON.stringify,
    fromStorage: JSON.parse,
}

/**
 * Create a signal that will persist its value in the storage. (localStorage by default)
 * The value will be serialized to a string before storing.
 * The value will be deserialized when retrieved from the storage.
 * If the storage is not available, it will return a regular signal.
 */
export function persistedSignal<T>(
    key: string,
    initialValue: T,
    options?: Partial<PersistedSignalOptions<T>>
) {
    let { storage, toStorage, fromStorage } = {
        ...DEFAULT_OPTIONS,
        ...options,
    }

    if (!storage) {
        // No storage available, return a regular signal
        console.warn("No storage available, using regular signal", key)
        return signal(initialValue)
    }

    let value = storage.getItem(key)
    let sig = signal<T>(value ? fromStorage(value) : initialValue)

    effect(() => {
        const newValue = toStorage(sig.value)
        const oldValue = fromStorage(storage.getItem(key)!)
        if (newValue !== oldValue) {
            storage.setItem(key, newValue)
        }
    })
    return sig
}
