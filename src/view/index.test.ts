import { beforeEach, describe, expect, it } from "bun:test"
import {
  signal,
  View,
  activeRoots,
  each,
  getEnv,
  live,
  onDispose,
  raw,
  render,
  setEnv,
  tags,
  text,
  view,
  when,
  setVerbose,
} from "./index"

export const getHTML = (node: Node | Node[]) => {
  const div = document.createElement("div")
  if (Array.isArray(node)) {
    node.forEach((n) => div.appendChild(n))
  } else {
    div.appendChild(node)
  }
  return div.innerHTML
}

describe("View", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""
  })

  it("Should allow view definition", () => {
    const Test = view(() => {})

    expect(Test).toBeDefined()
    expect(Test.styles).toBeDefined()
  })

  it("Should render simple HTML elements", () => {
    const Test = view(() => {
      tags.div({}, () => "Hello World")
    })

    expect(Test).toBeDefined()

    const output = Test()
    expect(output).toBeDefined()
    expect(output).toBeInstanceOf(View)
    expect(output.dom).toBeDefined()
    expect(output.dom.childNodes.length).toEqual(1)
    expect(getHTML(output.dom)).toEqual("<div>Hello World</div>")

    const remove = render(Test(), document.body)
    expect(activeRoots.size).toEqual(1)
    expect(document.body.innerHTML).toContain("Hello World")
    remove()
    expect(document.body.innerHTML).toEqual("")
    expect(activeRoots.size).toEqual(0)
  })

  it("Should render HTML elements with attributes", () => {
    const Test = view(() => {
      tags.div({ id: "test", class: "example" }, () => "Hello World")
    })

    expect(Test).toBeDefined()

    const output = Test()
    expect(output).toBeDefined()
    expect(getHTML(output.dom)).toEqual(
      '<div id="test" class="example">Hello World</div>'
    )

    const remove = render(Test(), document.body)
    expect(document.body.innerHTML).toContain("Hello World")
    remove()
    expect(document.body.innerHTML).toEqual("")
  })

  it("Should render HTML elements with dynamic attributes", () => {
    const id = signal("test")
    const Test = view(() => {
      const className = signal("example")

      tags.div({ id, class: className }, () => "Hello World")
    })

    expect(Test).toBeDefined()

    const output = Test()
    expect(output).toBeDefined()
    expect(getHTML(output.dom)).toEqual(
      '<div id="test" class="example">Hello World</div>'
    )

    const remove = render(Test(), document.body)
    expect(document.body.innerHTML).toContain("Hello World")
    expect(document.body.innerHTML).toContain('id="test"')
    id.set("new-id")
    expect(document.body.innerHTML).toContain('id="new-id"')

    remove()
    expect(document.body.innerHTML).toEqual("")
  })

  it("Should allow multiple call styles", () => {
    const div = tags.div

    const Test = view(() => {
      div("One")
      div(() => "Two")
      div({}, () => "Three")
      div({ class: "done" }, () => "Four")
      div(() => text("Five"))
      div(text("Six")) // This will not nest the text node
    })

    expect(Test).toBeDefined()

    const output = Test()
    expect(output).toBeDefined()
    expect(getHTML(output.dom)).toEqual(
      '<div>One</div><div>Two</div><div>Three</div><div class="done">Four</div><div>Five</div>Six<div></div>'
    )
    // console.log(getHTML(output.dom))
  })

  it("Should render nested HTML elements", () => {
    const Test = view(() => {
      tags.div({}, () => {
        tags.span({}, () => "Nested")
      })
    })

    expect(Test).toBeDefined()

    const output = Test()
    expect(output).toBeDefined()
    expect(getHTML(output.dom)).toEqual("<div><span>Nested</span></div>")

    const remove = render(Test(), document.body)
    expect(document.body.innerHTML).toContain("Nested")
    remove()
    expect(document.body.innerHTML).toEqual("")
  })

  it("Should render components with text children", () => {
    const MyComponent = view((_, children) => {
      tags.div({}, () => {
        text("Parent: ")
        children()
      })
    })

    expect(MyComponent).toBeDefined()

    const output = MyComponent({}, () => {
      tags.span({}, () => "Child")
    })

    expect(output).toBeInstanceOf(View)
    expect(getHTML(output.dom)).toEqual("<div>Parent: <span>Child</span></div>")
  })

  it("Should render components with text from signals", () => {
    const name = signal("John")
    const MyComponent = view(() => {
      tags.div({}, () => {
        text(name)
      })
    })
    const remove = render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("John")

    name.set("Jane")
    expect(document.body.innerHTML).toContain("Jane")

    remove()
    expect(document.body.innerHTML).toEqual("")
  })

  it("Should render components with props", () => {
    const MyComponent = view((props: { name: string }) => {
      tags.div({}, () => props.name)
    })

    expect(MyComponent).toBeDefined()

    const output = MyComponent({ name: "John" })

    expect(output).toBeInstanceOf(View)
    expect(getHTML(output.dom)).toEqual("<div>John</div>")
  })

  it("Should render children that return signals", () => {
    const count = signal(0)
    const MyComponent = view(() => {
      tags.div(() => count)
    })

    expect(MyComponent).toBeDefined()

    render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("<div>0</div>")

    count.set(1)
    expect(document.body.innerHTML).toContain("<div>1</div>")
  })

  it("Should support inserting raw html", () => {
    const MyComponent = view(() => {
      tags.div({}, () => raw("<span>Hello</span>"))
    })

    expect(MyComponent).toBeDefined()

    render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("<span>Hello</span>")
  })

  it("Should support inserting raw html as a tagged literal", () => {
    const MyComponent = view(() => {
      tags.div({}, () => raw`<span>Hello ${"bob"}</span>`)
    })

    expect(MyComponent).toBeDefined()

    render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("<span>Hello bob</span>")
  })

  it("Should support nested components", () => {
    const ChildComponent = view(() => {
      tags.div({}, () => text("Hello"))
    })

    const MyComponent = view(() => {
      ChildComponent()

      tags.div(() => {
        text("World")
      })
    })

    expect(MyComponent).toBeDefined()

    render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("Hello")
    expect(document.body.innerHTML).toContain("World")
  })

  it("Should support correct rendering order of nested components", () => {
    const ChildA = view(() => {
      text("Hello")
    })

    const ChildB = view(() => {
      text("World")
    })

    const MyComponent = view(() => {
      ChildA()
      text(" ")
      ChildB()
    })

    expect(MyComponent).toBeDefined()

    render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("Hello World")
  })

  it("Should support designed elements", () => {
    const Warning = tags.div.design.css`
      color: red;
    ` // ``
    const MyComponent = view(() => {
      tags.div({ class: "test" }, () => {
        Warning(() => text("Hello"))
      })
    })

    expect(MyComponent).toBeDefined()

    render(MyComponent(), document.body)
    // console.log(document.body.innerHTML)
    expect(document.body.innerHTML).toContain("Hello")
    expect(document.body.innerHTML).toContain("test")
    expect(document.body.innerHTML).toContain("css-")
  })

  it("Should designed elements that are designable", () => {
    const Message = tags.div.design.css`
      padding: 1rem;
    ` // ``
    const Warning = Message.design.css`
      color: red;
    ` // ``
    const MyComponent = view(() => {
      tags.div({ class: "test" }, () => {
        Warning(() => text("Hello"))
      })
    })

    expect(MyComponent).toBeDefined()

    render(MyComponent(), document.body)
    // console.log(document.body.innerHTML)
    expect(document.body.innerHTML).toContain("Hello")
    expect(document.body.innerHTML).toContain("test")
    expect(document.body.innerHTML).toContain("css-")
    expect(document.body.innerHTML.match(/css-/g)?.length).toEqual(2)
  })

  it("Should support designed elements with alt syntax", () => {
    const Warning = tags.div.design.css(/* css */ `
      color: red;
    `) // `
    const MyComponent = view(() => {
      tags.div({ class: "test" }, () => {
        Warning(() => text("Hello"))
      })
    })

    expect(MyComponent).toBeDefined()

    render(MyComponent(), document.body)
    // console.log(document.body.innerHTML)
    expect(document.body.innerHTML).toContain("Hello")
    expect(document.body.innerHTML).toContain("test")
    expect(document.body.innerHTML).toContain("css-")
  })

  it("Should support conditional rendering with `when` block", () => {
    const display = signal(false)

    const MyComponent = view(() => {
      tags.div({}, () => {
        when(
          () => display,
          () => {
            tags.div({}, () => "Hello")
          }
        )
      })
    })

    expect(MyComponent).toBeDefined()

    const dispose = render(MyComponent(), document.body)
    expect(document.body.innerHTML).not.toContain("Hello")

    display.set(true)
    expect(document.body.innerHTML).toContain("Hello")

    display.set(false)
    expect(document.body.innerHTML).not.toContain("Hello")

    display.set(true)
    expect(document.body.innerHTML).toContain("Hello")

    display.set(false)
    expect(document.body.innerHTML).not.toContain("Hello")

    dispose()
    expect(document.body.innerHTML).toEqual("")
  })

  it("Should support conditional fallback in `when` else block", () => {
    const display = signal(false)

    const MyComponent = view(() => {
      tags.div({}, () => {
        when(
          display,
          () => {
            tags.div("HELLO")
          },
          () => {
            tags.div("CRICKETS")
          }
        )
      })
    })

    expect(MyComponent).toBeDefined()

    render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("CRICKETS")

    display.set(true)
    expect(document.body.innerHTML).toContain("HELLO")

    display.set(false)
    expect(document.body.innerHTML).toContain("CRICKETS")
  })

  it("Should support onDispose callbacks with `when` blocks", () => {
    const display = signal(true)
    let trail: string[] = []

    const MyComponent = view(() => {
      tags.div({}, () => {
        when(
          display,
          () => {
            onDispose(() => {
              trail.push("then")
            })
            tags.div({}, () => "Then")
          },
          () => {
            onDispose(() => {
              trail.push("else")
            })
            tags.div("Else")
          }
        )
      })
    })

    expect(MyComponent).toBeDefined()

    const dispose = render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("Then")
    expect(trail).toEqual([])

    display.set(false)
    expect(document.body.innerHTML).toContain("Else")
    expect(trail).toEqual(["then"])

    display.set(true)
    expect(document.body.innerHTML).toContain("Then")
    expect(trail).toEqual(["then", "else"])

    display.set(false)
    expect(document.body.innerHTML).toContain("Else")
    expect(trail).toEqual(["then", "else", "then"])

    display.set(true)
    expect(document.body.innerHTML).toContain("Then")
    expect(trail).toEqual(["then", "else", "then", "else"])

    display.set(false)
    expect(document.body.innerHTML).toContain("Else")
    expect(trail).toEqual(["then", "else", "then", "else", "then"])

    dispose()
    expect(document.body.innerHTML).toEqual("")
    expect(trail).toEqual(["then", "else", "then", "else", "then", "else"])
  })

  it("Should be resilent to errors within `when` blocks", () => {
    const display = signal(false)
    const MyComponent = view(() => {
      tags.div(() => {
        when(
          display,
          () => {
            throw new Error("Error in when")
          },
          () => {
            tags.div("Else")
          }
        )
      })
    })

    expect(MyComponent).toBeDefined()

    const dispose = render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("Else")
    expect(document.body.innerHTML).not.toContain("Error")

    display.set(true)
    expect(document.body.innerHTML).toContain("Error")

    display.set(false)
    expect(document.body.innerHTML).not.toContain("Error")

    dispose()
    expect(document.body.innerHTML).toEqual("")
  })

  it("Should be resilent to errors within `when` else blocks", () => {
    const display = signal(true)
    const MyComponent = view(() => {
      tags.div(() => {
        when(
          display,
          () => {
            tags.div("Fine")
          },
          () => {
            throw new Error("Error in when else")
          }
        )
      })
    })

    expect(MyComponent).toBeDefined()

    const dispose = render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("Fine")
    expect(document.body.innerHTML).not.toContain("Error")

    display.set(false)

    expect(document.body.innerHTML).toContain("Error")
    expect(document.body.innerHTML).not.toContain("Fine")

    display.set(true)
    expect(document.body.innerHTML).toContain("Fine")
    expect(document.body.innerHTML).not.toContain("Error")

    dispose()
    expect(document.body.innerHTML).toEqual("")
  })

  it("Should be resilent to errors in the top-level block", () => {
    const MyComponent = view(() => {
      tags.div("Before")
      throw new Error("Error in top-level block")
      tags.div("After")
    })

    expect(MyComponent).toBeDefined()

    const dispose = render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("Error")
    expect(document.body.innerHTML).not.toContain("Before")
    expect(document.body.innerHTML).not.toContain("After")
    dispose()
    expect(document.body.innerHTML).toEqual("")
  })

  it("Should support conditional rendering with `live` block", () => {
    const display = signal(true)

    const MyComponent = view(() => {
      live(() => {
        if (display.value) {
          tags.div({}, () => "Hello")
        } else {
          tags.div({}, () => "Goodbye")
        }
      })
    })

    expect(MyComponent).toBeDefined()

    render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("Hello")
    expect(document.body.innerHTML).not.toContain("Goodbye")

    display.set(false)
    expect(document.body.innerHTML).not.toContain("Hello")
    expect(document.body.innerHTML).toContain("Goodbye")

    display.set(false)
    expect(document.body.innerHTML).not.toContain("Hello")
    expect(document.body.innerHTML).toContain("Goodbye")
  })

  it("Should support dispose of components within `live` blocks", () => {
    const display = signal(true)
    const { div } = tags

    let disposeCount = 0
    let trail: string[] = []

    const Yep = view(() => {
      div("Yep")
    })
    const Nope = view(() => {
      div("Nope")
    })

    const MyComponent = view(() => {
      onDispose(() => {
        trail.push("view")
        disposeCount++
      })

      live(() => {
        onDispose(() => {
          trail.push("live")
          disposeCount++
        })

        if (display.value) {
          Yep()
        } else {
          Nope()
        }
      })
    })

    expect(MyComponent).toBeDefined()

    const dispose = render(MyComponent(), document.body)

    expect(trail).toEqual([])
    expect(disposeCount).toEqual(0)
    expect(document.body.innerHTML).toContain("Yep")
    expect(document.body.innerHTML).not.toContain("Nope")

    display.set(false)
    expect(trail).toEqual(["live"])
    expect(disposeCount).toEqual(1)
    expect(document.body.innerHTML).not.toContain("Yep")
    expect(document.body.innerHTML).toContain("Nope")

    display.set(false) // Should not run live block again if value is the same
    expect(trail).toEqual(["live"])
    expect(disposeCount).toEqual(1)
    expect(document.body.innerHTML).not.toContain("Yep")
    expect(document.body.innerHTML).toContain("Nope")

    display.set(true)
    expect(trail).toEqual(["live", "live"])
    expect(disposeCount).toEqual(2)
    expect(document.body.innerHTML).toContain("Yep")
    expect(document.body.innerHTML).not.toContain("Nope")

    dispose()
    expect(trail).toEqual(["live", "live", "live", "view"])
    expect(disposeCount).toEqual(4)
  })

  it("Should support onDispose hooks for components", () => {
    let disposed = false
    const MyComponent = view((props, children) => {
      expect(onDispose).toBeDefined()
      expect(onDispose).toBeInstanceOf(Function)
      onDispose(() => {
        disposed = true
      })
      tags.div(() => {
        text("Hello")
      })
    })

    expect(MyComponent).toBeDefined()
    const remove = render(MyComponent(), document.body)

    expect(disposed).toBeFalse()
    expect(document.body.innerHTML).toContain("Hello")

    remove()
    expect(document.body.innerHTML).not.toContain("Hello")
    expect(disposed).toBeTrue()
  })

  it("Should support environment variables", () => {
    const MyComponent = view(() => {
      setEnv("name", "test")

      ChildComponent()
    })
    const ChildComponent = view(() => {
      const name = getEnv("name") as any

      tags.div({}, () => {
        text("Hello")
        text(name)
      })
    })

    expect(MyComponent).toBeDefined()

    const remove = render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("Hello")
    expect(document.body.innerHTML).toContain("test")
    remove()
  })

  it("should support array iteration with `each` block", () => {
    setVerbose(true)
    const obj = (name: string) => ({
      name,
      id: Math.random().toString(36).slice(2),
    })
    const items = signal([obj("one"), obj("two"), obj("three")])

    const MyComponent = view(() => {
      tags.div({ class: "List" }, () => {
        each(items, (item) => {
          tags.div({ class: "Item" }, () => item.name)
        })
      })
    })

    expect(MyComponent).toBeDefined()

    const remove = render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("one")
    expect(document.body.innerHTML).toContain("two")
    expect(document.body.innerHTML).toContain("three")

    items.set([items.peek()[2], obj("four"), obj("five"), obj("six")])

    expect(document.body.innerHTML).toContain("three")
    expect(document.body.innerHTML).toContain("four")
    expect(document.body.innerHTML).toContain("five")
    expect(document.body.innerHTML).toContain("six")
    expect(document.body.innerHTML).not.toContain("one")
    expect(document.body.innerHTML).not.toContain("two")

    // console.log(document.body.innerHTML)

    remove()
    setVerbose(false)
  })
})
