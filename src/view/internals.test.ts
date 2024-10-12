import { beforeEach, describe, expect, it } from "bun:test"
import {
  View,
  _activeRoots,
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
} from "./internals"
import { signal, setVerbose, computed } from "../internals"

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

  it("Should clean up global state after building", () => {
    const Test = view(() => {
      expect(View.active).toBeDefined()
    })

    expect(Test).toBeDefined()
    expect(View.active).toBeNull()
    const dispose = render(Test(), document.body)
    expect(View.active).toBeNull()

    expect(_activeRoots.size).toEqual(1)
    dispose()
    expect(_activeRoots.size).toEqual(0)
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
    expect(_activeRoots.size).toEqual(1)
    expect(document.body.innerHTML).toContain("Hello World")
    remove()
    expect(document.body.innerHTML).toEqual("")
    expect(_activeRoots.size).toEqual(0)
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
      div("One").use((el) => {
        el.innerHTML
      })
      div(() => "Two")
      div({}, () => "Three")
      div({ class: "done" }, () => "Four")
      div(() => text("Five"))
      div(() => text("Six")) // This will not nest the text node
    })

    expect(Test).toBeDefined()

    const output = Test()
    expect(output).toBeDefined()
    expect(getHTML(output.dom)).toEqual(
      '<div>One</div><div>Two</div><div>Three</div><div class="done">Four</div><div>Five</div><div>Six</div>'
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
    const Warning = tags.div.extend(`
      color: red;
    `)
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
    const Message = tags.div.extend(`
      padding: 1rem;
    `)
    const Warning = Message.extend(`
      color: red;
    `)
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
    const Warning = tags.div.extend({ color: "red" })
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

  it("Should support extending elements and adding modifiers", () => {
    const Button = tags.button.extend("color:maroon;", (mod, { element }) => ({
      outlined(color = "red") {
        element.style.outline = `1px solid ${color}`

        return mod
      },
    }))

    const MyComponent = view(() => {
      Button(() => text("Click Me")).outlined()
    })

    expect(Button).toBeDefined()
    const btn = Button()
    expect(btn).toBeDefined()
    // Default Modifiers
    expect(btn.css).toBeDefined()
    expect(btn.transitionName).toBeDefined()
    // custom modifiers
    expect(btn.outlined).toBeDefined()
    expect(btn.outlined).toBeFunction()

    expect(MyComponent).toBeDefined()

    render(MyComponent(), document.body)
    // console.log(document.body.innerHTML)
    expect(document.body.innerHTML).toContain("Click Me")
    expect(document.body.innerHTML).toContain("css-")
    expect(document.body.innerHTML).toContain("red") // from outlined modifier
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

  it("Shoud support onDispose hooks for components with children", () => {
    let disposeCount = 0
    let toggle = signal(true)

    const MyComponent = view((props, children) => {
      expect(onDispose).toBeDefined()
      expect(onDispose).toBeInstanceOf(Function)
      onDispose(() => {
        disposeCount++
      })
      tags.div(() => {
        children()
      })
      when(
        () => toggle,
        () => {
          onDispose(() => {
            disposeCount++
          })
          tags.div(() => {
            text("Hello")
          })
        },
        () => {
          onDispose(() => {
            disposeCount++
          })
          tags.div(() => {
            text("Goodbye")
          })
        }
      )
    })

    expect(MyComponent).toBeDefined()
    const remove = render(
      MyComponent({}, () => text("Welcome")),
      document.body
    )

    expect(disposeCount).toBe(0)
    expect(document.body.innerHTML).toContain("Welcome")
    expect(document.body.innerHTML).toContain("Hello")

    toggle.set(false)
    expect(document.body.innerHTML).toContain("Goodbye")
    expect(disposeCount).toBe(1)

    remove()
    expect(document.body.innerHTML).not.toContain("Hello")
    expect(disposeCount).toBe(3)
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
    const reused = obj("reused")
    const items = signal([obj("one"), obj("two"), reused])

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
    expect(document.body.innerHTML).toContain("reused")

    items.set([reused, obj("four"), obj("five"), obj("six")])

    expect(document.body.innerHTML).toContain("reused")
    expect(document.body.innerHTML).toContain("four")
    expect(document.body.innerHTML).toContain("five")
    expect(document.body.innerHTML).toContain("six")
    expect(document.body.innerHTML).not.toContain("one")
    expect(document.body.innerHTML).not.toContain("two")

    // console.log(document.body.innerHTML)

    remove()
    setVerbose(false)
  })

  it("should properly insert new items in `each` block", () => {
    let items = signal([
      signal({ id: "1", name: "one" }),
      signal({ id: "2", name: "two" }),
      signal({ id: "3", name: "three" }),
    ])
    const MyComponent = view(() => {
      tags.div({ class: "List" }, () => {
        each(
          items,
          (item) => {
            tags.div(() => get(() => item.value.name))
          },
          (item) => item.peek().id
        )
      })
    })

    const dispose = render(MyComponent(), document.body)
    expect(document.body.innerHTML).toContain("one")
    let ids: string[]

    ids = extractIdsFromEachItems(document.body.innerHTML)
    // console.log(document.body.innerHTML)
    expect(ids).toEqual(["1", "2", "3"])

    items.set([...items.peek(), signal({ id: "4", name: "four" })])

    ids = extractIdsFromEachItems(document.body.innerHTML)
    // console.log(ids)
    // console.log(document.body.innerHTML)
    expect(ids).toEqual(["1", "2", "3", "4"])

    items.set([signal({ id: "0", name: "zero" }), ...items.peek()])
    ids = extractIdsFromEachItems(document.body.innerHTML)
    expect(ids).toEqual(["0", "1", "2", "3", "4"])

    dispose()
  })
})

export const extractIdsFromEachItems = (html: string) => {
  // extract each-item comments in the order of the items in the string
  const comments = html.match(/<!--each-item_.*?-->/g)
  // for each comment, extract the id from the comment which are the values within parenthesis in the comment
  const ids = comments?.map((comment) => comment.match(/\((.*?)\)/)?.[1])
  return ids
}
export const get = (selector: () => any) => {
  const value = computed(() => selector())
  return value
}
