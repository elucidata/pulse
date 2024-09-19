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

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0))

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

    it("should add onUnmount function to cleanup stack", () => {
      const fn = mock(() => {})
      cleanupStack.push([])
      onUnmount(fn)
      expect(cleanupStack[0]).toContain(fn)
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
      const {node:fragment} = createComponent(Component, null, [])

      expect(fragment instanceof Node).toBe(true)
      expect(fragment.childNodes.length).toBe(1)
      expect((fragment.childNodes[0] as HTMLElement)?.tagName).toBe("DIV")

      expect(contextStack.length).toBe(1)
      expect(cleanupStack.length).toBe(1)
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
