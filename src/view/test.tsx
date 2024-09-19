/** @jsx h */

import { h } from "preact"
import { render } from "preact"
import { Signal, signal } from "../internals"
import { onMount, onUnmount, setContext, getContext } from "./runtime"
import { ComponentFunction } from "./types"

export { h, getContext, setContext, onMount, onUnmount } from "./runtime"

// Actions
function focusAction(el: HTMLElement) {
  el.focus()
}

// Example component with context and unmount hook
function Counter() {
  const count = signal(0)

  onMount(() => {
    console.log("Counter mounted")
  })

  onUnmount(() => {
    console.log("Counter unmounted")
  })

  setContext("countSignal", count)

  const increment = () => count.value++

  return (
    <div>
      <button onclick={increment}>Increment</button>
      <p>Count: {() => count.value}</p>
      <input use={focusAction} placeholder="Type here..." />
    </div>
  )
}

// Another component consuming context
function DisplayCount() {
  const count = getContext<Signal<number>>("countSignal")

  return <p>Shared Count: {() => count.value}</p>
}

// Main App component
function App() {
  const showCounter = signal(true)

  const toggleCounter = () => {
    showCounter.value = !showCounter.value
  }

  return (
    <main>
      <h1>Welcome to the Counter App</h1>
      <button onclick={toggleCounter}>
        {() => (showCounter.value ? "Hide" : "Show")} Counter
      </button>
      {() => (showCounter.value ? <Counter /> : null)}
      <DisplayCount />
    </main>
  )
}

// Mount the component
const appContainer = document.getElementById("app")
if (appContainer) {
  render(App, appContainer)
}

function Counter2() {
  const count = signal(0)

  onMount(() => {
    console.log("Counter mounted")
  })

  onUnmount(() => {
    console.log("Counter unmounted")
  })

  setContext("countSignal", count)

  const increment = () => count.value++

  return h(
    "div",
    null,
    h("button", { onclick: increment }, "Increment"),
    h("p", null, () => count.value),
    h("input", { use: focusAction, placeholder: "Type here..." })
  )
}
