# Pulse Signals

Pulse is a reactive programming library for managing state and side effects in TypeScript applications. It provides a set of primitives to create reactive signals, computed values, and effects, allowing you to build highly responsive and maintainable applications.

## Core Functionality

### Signals

A `Signal` is a reactive value that can be read and updated. When a signal's value changes, any computations or effects that depend on it are automatically re-run.

```typescript
import { signal } from '@elucidata/pulse';

const count = signal(0);

count.subscribe(value => {
    console.log(`Count is now ${value}`);
});

count.value = 1; // Logs: Count is now 1
```

### Computed Signals

A `ComputedSignal` is a read-only signal whose value is derived from other signals. It automatically updates when its dependencies change.

```typescript
import { computed, signal } from '@elucidata/pulse';

const count = signal(0);
const doubleCount = computed(() => count.value * 2);

doubleCount.subscribe(value => {
    console.log(`Double count is now ${value}`);
});

count.value = 2; // Logs: Double count is now 4
```

### Effects

An `Effect` is a function that runs whenever its dependencies change. Effects are useful for performing side effects, such as updating the DOM or making network requests.

```typescript
import { effect, signal } from '@elucidata/pulse';

const count = signal(0);

effect(() => {
    console.log(`Count is now ${count.value}`);
});

count.value = 1; // Logs: Count is now 1
```

## Usage Examples

### Basic Example

```typescript
import { signal, computed, effect } from '@elucidata/pulse';

const count = signal(0);
const doubleCount = computed(() => count.value * 2);

effect(() => {
    console.log(`Count: ${count.value}, Double Count: ${doubleCount.value}`);
});

count.value = 1; // Logs: Count: 1, Double Count: 2
count.value = 2; // Logs: Count: 2, Double Count: 4
```

### Advanced Example: Batching Updates

Batching allows you to group multiple updates together, ensuring that computations and effects are only run once after all updates are applied.

```typescript
import { batch, signal, effect } from '@elucidata/pulse';

const count1 = signal(0);
const count2 = signal(0);

effect(() => {
    console.log(`Count1: ${count1.value}, Count2: ${count2.value}`);
});

batch(() => {
    count1.value = 1;
    count2.value = 2;
}); // Logs: Count1: 1, Count2: 2
```

### Error Handling in Effects

You can provide an error handler to an effect to catch and handle errors that occur during its execution.

```typescript
import { effect, signal } from '@elucidata/pulse';

const count = signal(0);

effect(() => {
    if (count.value > 1) {
        throw new Error('Count is too high!');
    }
    console.log(`Count is ${count.value}`);
}, (error) => {
    console.error('Effect error:', error);
});

count.value = 2; // Logs: Effect error: Error: Count is too high!
```


## Observables

Observables in Pulse are reactive data sources that allow you to subscribe to values and provide methods for mapping and filtering. They are hot and lazy, meaning they start emitting values only when they have at least one subscriber and stop when all subscribers unsubscribe. Observables are also synchronous, emitting values immediately when available.

### Creating an Observable

You can create an observable using the `observable` function. The setup function receives an emit function to emit values and returns a teardown function to clean up resources.

```typescript
import { observable } from '@elucidata/pulse/utils';

const myObservable = observable<number>((emit) => {
    let count = 0;
    const interval = setInterval(() => {
        emit(count++);
    }, 1000);

    return () => clearInterval(interval);
});

myObservable.subscribe(value => {
    console.log(`Value: ${value}`);
});
```

### Mapping and Filtering Observables

Observables provide `map` and `filter` methods to transform and filter values.

```typescript
import { observable } from '@elucidata/pulse/utils';

const myObservable = observable<number>((emit) => {
    let count = 0;
    const interval = setInterval(() => {
        emit(count++);
    }, 1000);

    return () => clearInterval(interval);
});

const mappedObservable = myObservable.map(value => value * 2);
const filteredObservable = myObservable.filter(value => value % 2 === 0);

mappedObservable.subscribe(value => {
    console.log(`Mapped Value: ${value}`);
});

filteredObservable.subscribe(value => {
    console.log(`Filtered Value: ${value}`);
});
```

### Creating an Observable from a DOM Event

You can create an observable from a DOM event using the `fromDomEvent` function.

```typescript
import { fromDomEvent } from '@elucidata/pulse/utils';

const clickObservable = fromDomEvent(document, 'click');

clickObservable.subscribe(event => {
    console.log('Document clicked:', event);
});
```

Observables in Pulse provide a powerful way to work with reactive data streams, allowing you to build complex and responsive applications with ease.

## Advanced Topics

### Untracked Execution

Sometimes you may want to execute a function without tracking its dependencies. The `untracked` function allows you to do this.

```typescript
import { untracked, signal } from '@elucidata/pulse';

const count = signal(0);

untracked(() => {
    console.log(`Untracked count: ${count.value}`);
});

count.value = 1; // Does not trigger the untracked function
```

### Custom Events

Pulse Signals provides a simple event system that you can use to create custom events.

```typescript
import { event } from '@elucidata/pulse';

const myEvent = event<string>();

myEvent((message) => {
    console.log(`Received message: ${message}`);
});

myEvent.send('Hello, World!'); // Logs: Received message: Hello, World!
```

### Global Error Handling

You can set a global error handler to catch and handle errors that occur in any computation.

```typescript
import { Computation } from '@elucidata/pulse';

Computation.setGlobalErrorHandler((error) => {
    console.error('Global error handler:', error);
});
```




