export class Signal {
    _value;
    subscribers;
    dependents = new Set();
    constructor(value) {
        this._value = value;
    }
    get value() {
        if (Computation.current) {
            this.dependents.add(Computation.current);
            Computation.current.dependencies.add(this);
        }
        return this._value;
    }
    set value(newValue) {
        if (this._value !== newValue) {
            this._value = newValue;
            const dependents = Array.from(this.dependents);
            dependents.forEach((dep) => dep.invalidate());
            this.subscribers?.forEach((subscriber) => subscriber(newValue));
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
        if (!this.subscribers) {
            this.subscribers = new Set();
        }
        this.subscribers.add(run);
        return () => {
            this.subscribers.delete(run);
        };
    }
}
export class Computation {
    static lastId = 0;
    id = Computation.lastId++;
    fn;
    dependencies = new Set();
    isRunning = false;
    isCleaning = false;
    onInnerCleanup = void 0;
    onInvalidate = null;
    parentComputation;
    childComputations = new Set();
    constructor(fn, parentComputation = null) {
        this.fn = fn;
        this.parentComputation = parentComputation;
        this.run();
    }
    run() {
        if (this.isRunning) {
            return;
        }
        this.cleanup(false);
        Computation.stack.push(this);
        Computation.current = this;
        try {
            this.isRunning = true;
            const result = this.fn();
            if (typeof result === "function") {
                this.onInnerCleanup = result;
            }
            else {
                this.onInnerCleanup = void 0;
            }
        }
        finally {
            this.isRunning = false;
            Computation.stack.pop();
            Computation.current =
                Computation.stack[Computation.stack.length - 1] || null;
        }
    }
    invalidate() {
        if (Computation.isBatching) {
            Computation.pending.add(this);
        }
        else if (this.onInvalidate) {
            this.onInvalidate();
        }
        else {
            this.run();
        }
    }
    cleanup(clearFromParent = true) {
        if (this.isCleaning) {
            return;
        }
        this.isCleaning = true;
        Array.from(this.childComputations).forEach((child) => {
            child.cleanup();
        });
        // this.childComputations.clear()
        if (this.onInnerCleanup) {
            this.onInnerCleanup();
            this.onInnerCleanup = void 0;
        }
        this.dependencies.forEach((dep) => dep.dependents.delete(this));
        this.dependencies.clear();
        if (this.parentComputation && clearFromParent) {
            this.parentComputation.childComputations.delete(this);
        }
        this.isCleaning = false;
    }
    static current = null;
    static stack = [];
    static isBatching = false;
    static pending = new Set();
}
export class ComputedSignal {
    signal;
    cleanup;
    constructor(fn) {
        this.signal = new Signal(undefined);
        this.cleanup = effect(() => {
            this.signal.value = fn();
        });
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
}
export function signal(value) {
    return new Signal(value);
}
export function effect(fn) {
    const parentComputation = Computation.current;
    const computation = new Computation(fn, parentComputation);
    if (parentComputation) {
        parentComputation.childComputations.add(computation);
    }
    return () => computation.cleanup();
}
export function computed(fn) {
    return new ComputedSignal(fn);
}
export function batch(fn) {
    const prevBatching = Computation.isBatching;
    Computation.isBatching = true;
    try {
        fn();
    }
    finally {
        Computation.isBatching = prevBatching;
        if (!Computation.isBatching) {
            const computationsToRun = Array.from(Computation.pending);
            Computation.pending.clear();
            computationsToRun.forEach((comp) => comp.run());
        }
    }
}
export function isObservable(value) {
    return typeof signal === "object" && signal !== null && "get" in signal;
}
export function isReadonlySignal(signal) {
    return (typeof signal === "object" &&
        signal !== null &&
        "get" in signal &&
        "peek" in signal &&
        "subscribe" in signal);
}
//# sourceMappingURL=internals.js.map