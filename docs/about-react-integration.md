# Pulse React Integration

## Introduction

Pulse is a state management library designed to work seamlessly with React. This document outlines how to integrate Pulse with React, basic usage, and some advanced topics.

## Basic Usage

### Using Signals in React Components

To use signals in React components, you can use the `useComputed` hook provided by Pulse.

```typescript
import React from 'react';
import { useComputed } from '@elucidata/pulse/react';
import { count } from './path-to-your-signals';

const Counter = () => {
    const countValue = useComputed(count);

    return (
        <div>
            <p>Count: {countValue}</p>
            <button onClick={() => count.set(countValue + 1)}>Increment</button>
        </div>
    );
};

export default Counter;
```


### Using PulseComponent

The `PulseComponent` is a React component that helps in rendering Pulse components within a React application. It ensures that the Pulse component is properly mounted and unmounted, managing the lifecycle for you.

```typescript
import React from 'react';
import { PulseComponent } from '@elucidata/pulse/react';
import { MyPulseComponent } from './path-to-your-pulse-components';

const MyComponent = () => {
    return (
        <PulseComponent component={MyPulseComponent} props={{ someProp: 'value' }} />
    );
};

export default MyComponent;
```

### Using the observer HoC

The `observer` higher-order component (HoC) is used to make React components reactive to Pulse signals. This is particularly useful when you want to automatically re-render a component when a Pulse signal changes.

```typescript
import React from 'react';
import { observer } from '@elucidata/pulse/react';
import { count } from './path-to-your-signals';

const Counter = observer(() => {
    return (
        <div>
            <p>Count: {count.get()}</p>
            <button onClick={() => count.set(count.get() + 1)}>Increment</button>
        </div>
    );
});

export default Counter;
```

### Advanced Topics

#### Using useComputed for Derived State

The `useComputed` hook can be used to derive state from other signals or computations. This is useful for creating memoized values that depend on other signals.

```typescript
import React from 'react';
import { useComputed } from '@elucidata/pulse/react';
import { count } from './path-to-your-signals';

const DoubleCounter = () => {
    const doubleCount = useComputed(() => count.get() * 2);

    return (
        <div>
            <p>Double Count: {doubleCount}</p>
        </div>
    );
};

export default DoubleCounter;
```

#### Using useObservable for External Data

The `useObservable` hook allows you to integrate external observables with your React components. This is useful for integrating with other libraries or APIs that provide observable streams.

```typescript
import React from 'react';
import { useObservable } from '@elucidata/pulse/react';
import { myObservable } from './path-to-your-observables';

const MyObservableComponent = () => {
    const value = useObservable(myObservable, 'initial value');

    return (
        <div>
            <p>Observable Value: {value}</p>
        </div>
    );
};

export default MyObservableComponent;
```
