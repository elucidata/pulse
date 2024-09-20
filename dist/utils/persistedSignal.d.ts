export interface IStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
export interface PersistedSignalOptions<T> {
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
export declare function persistedSignal<T>(key: string, initialValue: T, options?: Partial<PersistedSignalOptions<T>>): import("../internals").Signal<T>;
