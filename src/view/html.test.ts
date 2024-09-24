import { describe, expect, it } from "bun:test"
import { html } from "./html"
import { render } from "./runtime"

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

describe("HTML Util", () => {
  it("should render simple HTML elements", () => {
    const resultHTML = renderHTML(() => html`<div>Hello World</div>`)
    expect(resultHTML).toEqual("<div>Hello World</div>")
  })

  it("should render HTML elements with attributes", () => {
    const resultHTML = renderHTML(
      () => html`<div id="test" class="example">Hello World</div>`
    )

    expect(resultHTML).toEqual(
      '<div id="test" class="example">Hello World</div>'
    )
  })

  it("should render nested HTML elements", () => {
    const resultHTML = renderHTML(() => html`<div><span>Nested</span></div>`)
    expect(resultHTML).toEqual("<div><span>Nested</span></div>")
  })

  it("should render components with props", () => {
    const MyComponent = (props: any) => html`<div>${props.name}</div>`

    const resultHTML = renderHTML(() => html`<${MyComponent} name="John" />`)
    expect(resultHTML).toEqual("<div>John</div>")
  })

  it("should render components with children", () => {
    const MyComponent = (_, children) => html`<div>${children}</div>`

    const resultHTML = renderHTML(
      () => html`<${MyComponent}>
        <span>Child</span>
      <//>`
    )
    expect(resultHTML).toEqual("<div><span>Child</span></div>")
  })
})
