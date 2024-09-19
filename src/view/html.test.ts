import { describe, expect, it } from "bun:test"
import { html } from "./html"
import { h } from "./runtime"

describe("HTML Util", () => {
  it("should render simple HTML elements", () => {
    const result = html`<div>Hello World</div>`
    expect(result).toEqual(h("div", {}, "Hello World"))
  })

  it("should render HTML elements with attributes", () => {
    const result = html`<div id="test" class="example">Hello World</div>`
    expect(result).toEqual(
      h("div", { id: "test", class: "example" }, "Hello World")
    )
  })

  it("should render nested HTML elements", () => {
    const result = html`<div><span>Nested</span></div>`
    expect(result).toEqual(h("div", {}, h("span", {}, "Nested")))
  })

  it("should render components with props", () => {
    const MyComponent = ({ name }: { name: string }) => html`<div>${name}</div>`

    const result = html`<${MyComponent} name="John" />`
    expect(result).toEqual(h(MyComponent, { name: "John" }))
  })

  it("should render components with children", () => {
    const MyComponent = (_, children) => html`<div>${children}</div>`

    const result = html`<${MyComponent}>
      <span>Child</span>
    <//>`
    expect(result).toEqual(h(MyComponent, {}, h("span", {}, "Child")))
  })
})
