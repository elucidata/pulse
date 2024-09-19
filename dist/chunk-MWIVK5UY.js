// src/internals.ts
var currentComputation = null;
function getCurrentComputation() {
  return currentComputation;
}
function setCurrentComputation(comp) {
  currentComputation = comp;
}
var computationStack = [];
var isBatching = false;
var pendingComputations = /* @__PURE__ */ new Set();
var Signal = class {
  _value;
  subscribers = /* @__PURE__ */ new Set();
  dependents = /* @__PURE__ */ new Set();
  constructor(value) {
    this._value = value;
  }
  get value() {
    if (currentComputation) {
      this.dependents.add(currentComputation);
      currentComputation.dependencies.add(this);
    }
    return this._value;
  }
  set value(newValue) {
    if (this._value !== newValue) {
      this._value = newValue;
      const dependents = new Set(this.dependents);
      dependents.forEach((dep) => dep.invalidate());
      this.subscribers.forEach((subscriber) => subscriber(newValue));
    }
  }
  peek() {
    return this._value;
  }
  get() {
    return this.value;
  }
  set(newValue) {
    this.value = newValue;
  }
  update(updater) {
    this.set(updater(this._value));
  }
  // Add the subscribe method to conform to Svelte's store interface
  subscribe(run) {
    run(this._value);
    this.subscribers.add(run);
    return () => {
      this.subscribers.delete(run);
    };
  }
};
var Computation = class {
  fn;
  dependencies = /* @__PURE__ */ new Set();
  isRunning = false;
  onInvalidate = null;
  constructor(fn) {
    this.fn = fn;
    this.run();
  }
  run() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.cleanup();
    computationStack.push(this);
    currentComputation = this;
    try {
      this.fn();
    } finally {
      computationStack.pop();
      currentComputation = computationStack[computationStack.length - 1] || null;
      this.isRunning = false;
    }
  }
  invalidate() {
    if (isBatching) {
      pendingComputations.add(this);
    } else if (this.onInvalidate) {
      this.onInvalidate();
    } else {
      this.run();
    }
  }
  cleanup() {
    this.dependencies.forEach((dep) => dep.dependents.delete(this));
    this.dependencies.clear();
  }
};
var ComputedSignal = class {
  signal;
  constructor(signal2) {
    this.signal = signal2;
  }
  get value() {
    return this.signal.value;
  }
  peek() {
    return this.signal.peek();
  }
  get() {
    return this.signal.get();
  }
  subscribe(run) {
    return this.signal.subscribe(run);
  }
};
function signal(value) {
  return new Signal(value);
}
function effect(fn) {
  new Computation(fn);
}
function computed(fn) {
  const internalSignal = new Signal(void 0);
  effect(() => {
    internalSignal.value = fn();
  });
  return new ComputedSignal(internalSignal);
}
function batch(fn) {
  const prevBatching = isBatching;
  isBatching = true;
  try {
    fn();
  } finally {
    isBatching = prevBatching;
    if (!isBatching) {
      const computationsToRun = Array.from(pendingComputations);
      pendingComputations.clear();
      computationsToRun.forEach((comp) => comp.run());
    }
  }
}
function isReadonlySignal(signal2) {
  return typeof signal2 === "object" && signal2 !== null && "get" in signal2 && "peek" in signal2 && "subscribe" in signal2;
}

export {
  getCurrentComputation,
  setCurrentComputation,
  Signal,
  Computation,
  signal,
  effect,
  computed,
  batch,
  isReadonlySignal
};
