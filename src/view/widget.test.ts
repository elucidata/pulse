import { beforeEach, describe, expect, it } from "bun:test"
import { styleCache } from "./css"
import { h, render } from "./runtime"
import { widget } from "./widget"

export const getHTML = (node: Node | Node[]) => {
  const div = document.createElement("div")
  if (Array.isArray(node)) {
    node.forEach((n) => div.appendChild(n))
  } else {
    div.appendChild(node)
  }
  return div.innerHTML
}
const renderHTML = (worker: () => Node | Node[]) => {
  let renderResult: any
  const Root = () => {
    renderResult = worker()
    return null
  }
  const unmount = render(Root, document.createElement("div"))
  unmount()
  return getHTML(renderResult)
}
const styleCacheKey = (key: string) => key.split(" ")[0]

describe("widget", () => {
  beforeEach(() => {
    styleCache.clear()
    document.adoptedStyleSheets = []
    document.head.innerHTML = ""
    document.body.innerHTML = ""
  })

  it("should create a div with the correct CSS classes", () => {
    const Component = widget.div.css(["display: flex;"] as any)
    const props = { class: "custom-class" }
    const children = ["Child content"]

    const result = renderHTML(() => Component(props, children))

    expect(result).toEqual(
      `<div class="custom-class ${Component.className}">Child content</div>`
    )
    expect(styleCache.get(Component.className)).toContain("display: flex;")
  })

  it("should allow chaining of CSS classes", () => {
    const Component = widget.div.isIt.Good.css(["color: blue;"] as any)
    const props = { class: "custom-class" }
    const children = ["Child content"]

    const result = renderHTML(() => Component(props, children))
    expect(Component.className).toContain("isIt Good")
    expect(result).toEqual(
      `<div class="custom-class ${Component.className}">Child content</div>`
    )
    expect(styleCache.get(styleCacheKey(Component.className))).toContain(
      "color: blue;"
    )
  })

  it("should create a section with the correct CSS classes", () => {
    const Component = widget.section.css`height: 100vh;`

    const result = renderHTML(() =>
      Component({ class: "custom-class" }, ["Child content"])
    )
    expect(result).toEqual(
      `<section class="custom-class ${Component.className}">Child content</section>`
    )
  })

  it("should create a root widget with default div tag", () => {
    const Component = widget.css`color: red;`
    const result = renderHTML(() =>
      Component({ class: "custom-class" }, ["Child content"])
    )
    expect(result).toEqual(
      `<div class="custom-class ${Component.className}">Child content</div>`
    )
    expect(styleCache.get(styleCacheKey(Component.className))).toContain(
      "color: red;"
    )
  })

  it("should allow extending a widget", () => {
    const Component = widget.div.Parent.css`color: red;`
    const ExtendedComponent = widget.extend(Component).Child.css`color: blue;`
    const resultHTML = renderHTML(() =>
      ExtendedComponent({ class: "custom-class" }, ["Child content"])
    )
    expect(resultHTML).toEqual(
      `<div class="custom-class ${ExtendedComponent.className} ${Component.className}">Child content</div>`
    )
  })

  it("should allow extending a plain component", () => {
    const Component = (props: any) => h("div", props, "Child content")
    const ExtendedComponent = widget.extend(Component).Child.css`color: blue;`

    const result = renderHTML(() =>
      ExtendedComponent({ class: "custom-class" }, ["Child content"])
    )

    expect(result).toEqual(
      `<div class="custom-class ${ExtendedComponent.className}">Child content</div>`
    )
  })
})
