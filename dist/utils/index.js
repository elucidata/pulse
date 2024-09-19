import {
  effect,
  signal
} from "../chunk-MWIVK5UY.js";

// src/utils/persistedSignal.ts
var DEFAULT_OPTIONS = {
  storage: globalThis.localStorage,
  toStorage: JSON.stringify,
  fromStorage: JSON.parse
};
function persistedSignal(key, initialValue, options) {
  let { storage, toStorage, fromStorage } = {
    ...DEFAULT_OPTIONS,
    ...options
  };
  if (!storage) {
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

// src/utils/update.ts
function update(state, updater, reportChanges = false) {
  const oldState = state.peek();
  const newState = typeof updater === "function" ? updater(oldState) : updater;
  const isScalar = typeof newState !== "object" || newState === null;
  if (isScalar) {
    return state.set(newState);
  } else {
    const updatedState = { ...oldState, ...newState };
    state.set(updatedState);
    return reportChanges ? changedFields(oldState, updatedState) : void 0;
  }
}
function changedFields(oldState, newState) {
  let oldKeys = Reflect.ownKeys(oldState);
  let newKeys = Reflect.ownKeys(newState);
  let addedKeys = newKeys.filter((key) => !oldKeys.includes(key));
  let removedKeys = oldKeys.filter((key) => !newKeys.includes(key));
  let changedKeys = oldKeys.filter(
    (key) => oldState[key] !== newState[key]
  );
  return [...addedKeys, ...removedKeys, ...changedKeys];
}
export {
  persistedSignal,
  update
};
