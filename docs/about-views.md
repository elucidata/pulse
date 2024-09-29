# Pulse View

Pulse View is a declarative, reactive, statement-based UI toolkit designed to simplify the process of building dynamic user interfaces. It leverages the power of reactive programming to ensure your UI stays in sync with your application state, providing a seamless and efficient development experience.

## Features

- **Declarative Syntax**: Define your UI components in a clear and readable manner.
- **Reactive Updates**: Automatically update the UI when the underlying state changes.
- **Composable Views**: Easily compose complex views from smaller, reusable components.
- **Lifecycle Hooks**: Manage component lifecycle with hooks like `onDispose`.
- **Conditional Rendering**: Render components conditionally with `when` and `live` functions.

## Getting Started

Here's a simple example to get you started with Pulse View:

```typescript
import { view, signal, render, tags } from '@elucidata/pulse/view';

const { div, button } = tags;

const counter = signal(0);

const CounterView = view(() => {
    div(() => {
        button({ onClick: () => counter.value++ }, 'Increment');
        div(`Count: ${counter.value}`);
    });
});

const app = CounterView();
render(app, document.getElementById('app'));
```

## API Overview

### `view`

Creates a new view component.

```typescript
function view<P>(builder: DomBuilder<P>): ViewFactory<P>
```

### `signal`

Creates a reactive signal.

```typescript
function signal<T>(value: T): Signal<T>
```

### `render`

Renders a view instance to a target DOM element.

```typescript
function render(viewInstance: View<any>, target: HTMLElement): () => void
```

### `tags`

A proxy object that provides functions to create HTML elements.

```typescript
const { div, button, span, ... } = tags;
```

### `when`

Conditionally renders a view based on a boolean condition.

```typescript
function when(
    condition: ReadonlySignal<boolean> | boolean | (() => boolean | ReadonlySignal<boolean>),
    thenBuilder: () => void,
    elseBuilder?: () => void
): void
```

### `live`

Re-renders a block when any observed signals change.

```typescript
function live(builder: () => void): void
```

## Advanced Usage

### Lifecycle Hooks

Use the `onDispose` hook to perform cleanup when a component is disposed.

```typescript
import { onDispose } from '@elucidata/pulse/view';

view(() => {
    onDispose(() => {
        console.log('Component disposed');
    });
});
```

### Environment Variables

Set and get environment variables within views.

```typescript
import { setEnv, getEnv } from '@elucidata/pulse/view';

view(() => {
    setEnv('theme', 'dark');
    const theme = getEnv('theme');
    console.log(theme); // 'dark'
});
```
