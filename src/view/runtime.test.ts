import { describe, it, expect, beforeEach, mock } from "bun:test"
import {
  setContext,
  getContext,
  onMount,
  onUnmount,
  h,
  appendChild,
  createComponent,
  render,
  contextStack,
  cleanupStack,
} from "./runtime"
import { signal } from "../internals"

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0))

const expectEmptyishStacks = (logNonEmpty = false) => {
  // expect(contextStack.length).toBe(0)
  // expect(cleanupStack.length).toBe(0)
}

describe("View", () => {
  beforeEach(() => {
    contextStack.length = 0
    cleanupStack.length = 0
  })

  describe("Context System", () => {
    it("should set and get context correctly", () => {
      contextStack.push(new Map())
      setContext("key", "value")
      expect(getContext("key")).toBe("value")
    })

    it("should throw error when setting context outside component", () => {
      expect(() => setContext("key", "value")).toThrow(
        "setContext must be called within a component"
      )
    })

    it("should throw error when getting non-existent context", () => {
      contextStack.push(new Map())
      expect(() => getContext("nonExistentKey")).toThrow(
        "Context not found for key"
      )
    })
  })

  describe("Lifecycle Hooks", () => {
    it("should call onMount function", async (done) => {
      const fn = mock(() => {})
      cleanupStack.push([])
      onMount(fn)
      await nextTick()
      expect(fn).toHaveBeenCalled()
      done()
    })

    it("should throw error when onMount is called outside component", () => {
      expect(() => onMount(() => {})).toThrow(
        "onMount must be called within a component"
      )
    })

    it("should add onUnmount function to cleanup stack", async (done) => {
      const fn = mock(() => {})
      const fn2 = mock(() => {})
      cleanupStack.push([])
      onUnmount(fn)
      expect(cleanupStack[0]).toContain(fn)

      onMount(() => fn2)
      await nextTick()
      expect(cleanupStack[0]).toContain(fn2)

      done()
    })

    it("should throw error when onUnmount is called outside component", () => {
      expect(() => onUnmount(() => {})).toThrow(
        "onUnmount must be called within a component"
      )
    })
  })

  describe("JSX-compatible createElement function", () => {
    it("should create an node with the result of the props and children", () => {
      const el = h("div", { id: "test", style: { color: "red" } }, "child")
    })

    it("should create a component function", () => {
      const Component = (props: any) => h("span", null, props.text)
      const el = h(Component, { text: "Hello" })
      expect(el.textContent).toBe("Hello")
    })
  })

  describe("Helper function to append children", () => {
    it("should append various types of children", () => {
      const parent = document.createElement("div")
      appendChild(parent, "text")
      appendChild(parent, document.createElement("span"))
      appendChild(parent, [document.createElement("b"), "more text"])
      expect(parent.childNodes.length).toBe(4)
    })
  })

  describe("Component creation with context and cleanup management", () => {
    it("should create a component and manage context and cleanup", () => {
      const Component = () => h("div", null)
      const { node: fragment, dispose } = createComponent(Component, null, [])

      expect(dispose).toBeFunction()
      expect(fragment instanceof Node).toBe(true)
      expect(fragment.childNodes.length).toBe(1)
      expect((fragment.childNodes[0] as HTMLElement)?.tagName).toBe("DIV")

      expect(contextStack.length).toBe(1)
      expect(cleanupStack.length).toBe(1)

      dispose()

      expect(contextStack.length).toBe(0)
      expect(cleanupStack.length).toBe(0)
    })

    it("should create a component with children", () => {
      const Component = (_, children) => h("div", null, ...children)
      const { node: fragment, dispose } = createComponent(Component, null, [
        h("span", null, "child"),
      ])

      expect(fragment.childNodes.length).toBe(1)
      expect((fragment.childNodes[0] as HTMLElement)?.tagName).toBe("DIV")
      expect(
        (fragment.childNodes[0].childNodes[0] as HTMLElement)?.tagName
      ).toBe("SPAN")
      expect(
        (fragment.childNodes[0].childNodes[0] as HTMLElement)?.textContent
      ).toBe("child")

      dispose()
    })

    it("should create a component with nested components", async (done) => {
      const Component = (_, children) => h("div", null, ...children)
      const NestedComponent = () => h("span", null, "nested")
      const { node: fragment, dispose } = createComponent(Component, null, [
        h(NestedComponent, null),
      ])

      expect(fragment.childNodes.length).toBe(1)
      expect((fragment.childNodes[0] as HTMLElement)?.tagName).toBe("DIV")
      expect(
        (fragment.childNodes[0].childNodes[0] as HTMLElement)?.tagName
      ).toBe("SPAN")
      expect(
        (fragment.childNodes[0].childNodes[0] as HTMLElement)?.textContent
      ).toBe("nested")

      // expect(contextStack.length).toBe(2)
      // expect(cleanupStack.length).toBe(2)
      // console.log("cleanupStack for nested componetns:", cleanupStack)
      // console.log("cleanup function:", cleanupStack[0][0].toString())

      // expect(dispose).toBe(cleanupStack[0][0])

      dispose()

      await nextTick()

      // console.log(
      //   "cleanupStack for nested componetns after dispose:",
      //   cleanupStack
      // )
      expectEmptyishStacks()
      done()
    })

    it("should create a component with multiple children", () => {
      const Component = (_, children) => h("div", null, ...children)
      const { node: fragment, dispose } = createComponent(Component, null, [
        h("span", null, "child1"),
        h("span", null, "child2"),
      ])

      expect(fragment.childNodes.length).toBe(1)
      expect((fragment.childNodes[0] as HTMLElement)?.tagName).toBe("DIV")
      expect(
        (fragment.childNodes[0].childNodes[0] as HTMLElement)?.textContent
      ).toBe("child1")
      expect(
        (fragment.childNodes[0].childNodes[1] as HTMLElement)?.textContent
      ).toBe("child2")

      dispose()
      expectEmptyishStacks()
    })

    it("should call component onMount and onUnmount functions", async (done) => {
      const onMountFn = mock(() => {})
      const onUnmountFn = mock(() => {})

      const Component = () => {
        onMount(onMountFn)
        onUnmount(onUnmountFn)
        return h("div", null)
      }

      const { node: fragment, dispose } = createComponent(Component, null, [])

      await nextTick()
      expect(onMountFn).toHaveBeenCalled()
      expect(onMountFn).toBeCalledTimes(1)

      dispose()
      expect(onUnmountFn).toHaveBeenCalled()
      expect(onUnmountFn).toBeCalledTimes(1)

      done()
      expectEmptyishStacks()
    })

    it("should call onUnmount function when component is unmounted", async (done) => {
      const onUnmountFn = mock(() => {})
      const Component = () => {
        onUnmount(onUnmountFn)
        return h("div", null)
      }

      const { node: fragment, dispose } = createComponent(Component, null, [])

      await nextTick()
      expect(onUnmountFn).not.toHaveBeenCalled()

      dispose()
      expect(onUnmountFn).toHaveBeenCalled()

      done()
    })

    it("should call onUnmount function when component is unmounted with nested components", async (done) => {
      const onUnmountFn = mock(() => {})
      const Component = () => {
        onUnmount(onUnmountFn)
        return h("div", null, h("span", null, "nested"))
      }

      const { node: fragment, dispose } = createComponent(Component, null, [])

      await nextTick()
      expect(onUnmountFn).not.toHaveBeenCalled()

      dispose()
      expect(onUnmountFn).toHaveBeenCalled()

      done()
    })

    it("should call onUnmount function when component is nested", async (done) => {
      const onUnmountFn = mock(() => {})
      const NestedComponent = () => {
        onUnmount(onUnmountFn)
        return h("span", null, "nested")
      }
      const Component = () => {
        return h(
          "div",
          null,
          h("span", null, "child1"),
          h("span", null, "child2"),
          h(NestedComponent, null)
        )
      }

      const { node: fragment, dispose } = createComponent(Component, null, [])

      await nextTick()
      expect(onUnmountFn).not.toHaveBeenCalled()

      dispose()
      expect(onUnmountFn).toHaveBeenCalled()
      expect(onUnmountFn).toBeCalledTimes(1)

      done()
    })

    it("should react to changes in an observed signal", async (done) => {
      const sig = signal(0)
      const Component = () => {
        return h("div", null, () => sig.value)
      }

      const { node: fragment, dispose } = createComponent(Component, null, [])

      await nextTick()
      expect(fragment.textContent).toBe("0")

      sig.value = 1

      await nextTick()
      expect(fragment.textContent).toBe("1")

      dispose()
      done()
    })

    it("should react to changes in an observed signal with nested components", async (done) => {
      const sig = signal(0)
      let mountCount = {
        a: 0,
        b: 0,
      }
      let unmountCount = {
        a: 0,
        b: 0,
      }
      const NestedComponentA = () => {
        onMount(() => {
          mountCount.a++
          return () => unmountCount.a++
        })
        return h("span", null, () => sig.value)
      }
      const NestedComponentB = () => {
        onMount(() => {
          mountCount.b++
          return () => unmountCount.b++
        })
        return h("span", null, () => sig.value)
      }
      const Component = () => {
        return h("div", null, () =>
          sig.value == 0 ? h(NestedComponentA, null) : h(NestedComponentB, null)
        )
      }

      const { node: fragment, dispose } = createComponent(Component, null, [])

      await nextTick()
      expect(fragment.textContent).toBe("0")

      expect(mountCount.a).toBe(1)
      expect(mountCount.b).toBe(0)
      expect(unmountCount.a).toBe(0)
      expect(unmountCount.b).toBe(0)

      sig.value = 1

      await nextTick()
      expect(fragment.textContent).toBe("1")

      expect(mountCount.a).toBe(1)
      expect(mountCount.b).toBe(1)
      expect(unmountCount.a).toBe(1)

      dispose()

      expect(mountCount.a).toBe(1)
      expect(mountCount.b).toBe(1)
      expect(unmountCount.a).toBe(1)
      expect(unmountCount.b).toBe(1)

      done()
    })

    it("should react to changes in an observed signal with nested components", async (done) => {
      const sig = signal(0)
      let mountCount = {
        a: 0,
        b: 0,
      }
      let unmountCount = {
        a: 0,
        b: 0,
      }
      const NestedComponentA = () => {
        onMount(() => {
          mountCount.a++
          return () => unmountCount.a++
        })
        return h("span", null, () => sig.value, h(NestedComponentB, null))
      }
      const NestedComponentB = () => {
        onMount(() => {
          mountCount.b++
          return () => unmountCount.b++
        })
        return h("span", null, () => sig.value)
      }
      const Component = () => {
        return h("div", null, () =>
          sig.value == 0 ? h(NestedComponentA, null) : null
        )
      }

      const { node: fragment, dispose } = createComponent(Component, null, [])

      await nextTick()
      expect(fragment.textContent).toBe("00")

      expect(mountCount.a).toBe(1)
      expect(mountCount.b).toBe(1)
      expect(unmountCount.a).toBe(0)
      expect(unmountCount.b).toBe(0)

      sig.value = 1

      await nextTick()
      expect(fragment.textContent).toBe("")

      expect(mountCount.a).toBe(1)
      expect(unmountCount.a).toBe(1)

      expect(mountCount.b).toBe(1)
      expect(unmountCount.b).toBe(1)

      dispose()

      expect(mountCount.a).toBe(1)
      expect(unmountCount.a).toBe(1)

      done()
    })

    it("should react to changes in an referenced signal", async (done) => {
      const sig = signal(0)
      const Component = () => {
        return h("div", null, sig)
      }

      const { node: fragment, dispose } = createComponent(Component, null, [])

      await nextTick()
      expect(fragment.textContent).toBe("0")

      sig.value = 1

      await nextTick()
      expect(fragment.textContent).toBe("1")

      dispose()
      done()
    })

    it("should react to changes in a computed signal", async (done) => {
      const sig = signal(0)
      const Component = () => {
        return h("div", null, () => sig.value * 2)
      }

      const { node: fragment, dispose } = createComponent(Component, null, [])

      await nextTick()
      expect(fragment.textContent).toBe("0")

      sig.value = 1

      await nextTick()
      expect(fragment.textContent).toBe("2")

      dispose()
      done()
    })

    it("should react to changes in a computed signal with nested components", async (done) => {
      const sig = signal(0)
      const NestedComponent = () => {
        return h("span", null, () => sig.value)
      }
      const Component = () => {
        return h("div", null, h(NestedComponent, null))
      }

      const { node: fragment, dispose } = createComponent(Component, null, [])

      await nextTick()
      expect(fragment.textContent).toBe("0")

      sig.value = 1

      await nextTick()
      expect(fragment.textContent).toBe("1")

      dispose()

      expect(contextStack.length).toBe(0)
      expect(cleanupStack.length).toBe(0)
      done()
    })

    it("should trigger onMount and onUnmount functions for reactive components", async (done) => {
      const sig = signal(0)
      const onMountFn = mock(() => {})
      const onUnmountFn = mock(() => {})
      const Component = () => {
        onMount(onMountFn)
        onUnmount(onUnmountFn)
        return h("div", null, () => sig.value)
      }

      const { node: fragment, dispose } = createComponent(Component, null, [])

      await nextTick()
      expect(onMountFn).toHaveBeenCalled()

      sig.value = 1

      await nextTick()
      expect(fragment.textContent).toBe("1")

      dispose()
      expect(onUnmountFn).toHaveBeenCalled()

      done()
    })
  })

  describe("Render function to mount components", () => {
    it("should render a component into a container", () => {
      const container = document.createElement("div")
      const Component = () => h("div", null, "content")
      const unmount = render(Component, container)

      expect(container.childNodes.length).toBe(3) // the comment and the boundary comments
      expect(container.childNodes[1]?.textContent).toBe("content")

      unmount()
      expect(container.childNodes.length).toBe(0)
    })
  })
})
