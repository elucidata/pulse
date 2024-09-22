import { describe, it, expect, beforeEach, mock, jest, spyOn } from "bun:test"
import { widget } from "./widget"
import { h } from "./runtime"
import { classNames } from "./css"

const getHTML = (node: Node | Node[]) => {
  const div = document.createElement("div")
  if (Array.isArray(node)) {
    node.forEach((n) => div.appendChild(n))
  } else {
    div.appendChild(node)
  }
  return div.innerHTML
}

describe("widget", () => {
  it("should create a div with the correct CSS classes", () => {
    const styles = ["display: flex;"]
    const Component = widget.div.css(styles as any)
    const props = { class: "custom-class" }
    const children = ["Child content"]

    const result = Component(props, children)

    expect(result).toBeInstanceOf(Node)
    expect(getHTML(result)).toEqual(
      getHTML(
        h(
          "div",
          {
            ...props,
            class: classNames(props.class, Component.className),
          },
          ...children
        )
      )
    )
  })

  it("should allow chaining of CSS classes", () => {
    const styles = ["color: blue;"]
    const Component = widget.div.isIt.Good.css(styles as any)
    const props = { class: "custom-class" }
    const children = ["Child content"]

    const result = Component(props, children)

    expect(result).toBeInstanceOf(Node)
    expect(getHTML(result)).toEqual(
      getHTML(
        h(
          "div",
          {
            ...props,
            class: classNames(props.class, Component.className, ""),
          },
          ...children
        )
      )
    )
    expect(getHTML(result)).toContain("isIt Good")
  })

  it("should create a section with the correct CSS classes", () => {
    const styles = ["height: 100vh;"]
    const Component = widget.section.css(styles as any)
    const props = { class: "custom-class" }
    const children = ["Child content"]

    const result = Component(props, children)
    expect(result).toBeInstanceOf(Node)

    expect(getHTML(result)).toEqual(
      getHTML(
        h(
          "section",
          {
            ...props,
            class: classNames(props.class, Component.className, ""),
          },
          ...children
        )
      )
    )
  })

  it("should extend the widget object", () => {
    expect(typeof widget.extend).toBe("function")
  })

  it("should create a root widget with default div tag", () => {
    const styles = ["color: red;"]
    const Component = widget.css(styles as any)
    const props = { class: "custom-class" }
    const children = ["Child content"]

    const result = Component(props, children)

    expect(result).toBeInstanceOf(Node)
    expect(getHTML(result)).toEqual(
      getHTML(
        h(
          "div",
          {
            ...props,
            class: classNames(props.class, Component.className),
          },
          ...children
        )
      )
    )
  })

  it("should allow extending a widget", () => {
    const styles = ["color: red;"]
    const Component = widget.div.Parent.css(styles as any)
    const ExtendedComponent = widget.extend(Component).Child.css`color: blue;`
    const props = { class: "custom-class" }
    const children = ["Child content"]

    const result = ExtendedComponent(props, children)

    expect(result).toBeInstanceOf(Node)
    const resultHTML = getHTML(result)
    const expectedHTML = getHTML(
      h(
        "div",
        {
          ...props,
          class: classNames(
            props.class,
            ExtendedComponent.className,
            Component.className
          ),
        },
        ...children
      )
    )

    expect(resultHTML).toEqual(expectedHTML)
    expect(resultHTML).toContain("custom-class")
    expect(resultHTML).toContain("Parent")
    expect(resultHTML).toContain("Child")
    // console.log(resultHTML)
  })

  it("should allow extending a plain component", () => {
    const Component = (props: any) => h("div", props, "Child content")
    const ExtendedComponent = widget.extend(Component).Child.css`color: blue;`
    const props = { class: "custom-class" }
    const children = ["Child content"]

    const result = ExtendedComponent(props, children)

    expect(result).toBeInstanceOf(Node)
    const resultHTML = getHTML(result)
    const expectedHTML = getHTML(
      h(
        "div",
        {
          ...props,
          class: classNames(props.class, ExtendedComponent.className),
        },
        ...children
      )
    )

    expect(resultHTML).toEqual(expectedHTML)
    expect(resultHTML).toContain("custom-class")
    expect(resultHTML).toContain("Child")
    // console.log(resultHTML)
  })
})
