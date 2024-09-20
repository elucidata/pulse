import { effect, signal } from "../internals";
const DEFAULT_OPTIONS = {
    storage: globalThis.localStorage,
    toStorage: JSON.stringify,
    fromStorage: JSON.parse,
};
/**
 * Create a signal that will persist its value in the storage. (localStorage by default)
 * The value will be serialized to a string before storing.
 * The value will be deserialized when retrieved from the storage.
 * If the storage is not available, it will return a regular signal.
 */
export function persistedSignal(key, initialValue, options) {
    let { storage, toStorage, fromStorage } = {
        ...DEFAULT_OPTIONS,
        ...options,
    };
    if (!storage) {
        // No storage available, return a regular signal
        console.warn("No storage available, using regular signal", key);
        return signal(initialValue);
    }
    let value = storage.getItem(key);
    let sig = signal(value ? fromStorage(value) : initialValue);
    effect(() => {
        const newValue = toStorage(sig.value);
        const oldValue = fromStorage(storage.getItem(key));
        if (newValue !== oldValue) {
            storage.setItem(key, newValue);
        }
    });
    return sig;
}
//# sourceMappingURL=persistedSignal.js.map