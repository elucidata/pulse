import { beforeEach, describe, expect, it } from "bun:test"
import { signal } from "../../internals"
import {
    Component,
    activeRoots,
    getEnv,
    live,
    render,
    setEnv,
    tags,
    text,
    view,
    when,
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

describe("View TNG", () => {
    beforeEach(() => {
        document.head.innerHTML = ""
        document.body.innerHTML = ""
    })

    it("Should all component definition", () => {
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
        expect(output).toBeInstanceOf(Component)
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

        expect(output).toBeInstanceOf(Component)
        expect(getHTML(output.dom)).toEqual(
            "<div>Parent: <span>Child</span></div>"
        )
    })

    it("Should render components with props", () => {
        const MyComponent = view((props: { name: string }) => {
            tags.div({}, () => props.name)
        })

        expect(MyComponent).toBeDefined()

        const output = MyComponent({ name: "John" })

        expect(output).toBeInstanceOf(Component)
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

    it.only("Should support conditional rendering with `when` block", () => {
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

    it.only("Should support conditional fallback", () => {
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

    it.only("Should be resilent to errors within `when` blocks", () => {
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

    it.only("Should be resilent to errors within `when` else blocks", () => {
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

    it.only("Should support conditional rendering with `live` block", () => {
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

    it.skip("Should support dispose of components within `live` blocks", () => {
        const display = signal(true)
        const { div } = tags

        const Yep = view(() => {
            div("Yep")
        })
        const Nope = view(() => {
            div("Nope")
        })

        const MyComponent = view(() => {
            live(() => {
                if (display.value) {
                    Yep()
                } else {
                    Nope()
                }
            })
        })

        expect(MyComponent).toBeDefined()

        render(MyComponent(), document.body)
        expect(document.body.innerHTML).toContain("Yep")
        expect(document.body.innerHTML).not.toContain("Nope")

        display.set(false)
        expect(document.body.innerHTML).not.toContain("Yep")
        expect(document.body.innerHTML).toContain("Nope")

        display.set(false)
        expect(document.body.innerHTML).not.toContain("Yep")
        expect(document.body.innerHTML).toContain("Nope")
    })

    it("Should support onDispose hooks for components", () => {
        let disposed = false
        const MyComponent = view((props, children, { onDispose }) => {
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
            const name = getEnv("name")

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

    // it.skip("Should support complex conditional rendering", () => {
    //   const display = signal("loading" as "loading" | "error" | "success")
    //   const MyComponent = view(() => {
    //     tags.div({}, () => {
    //       select(() => {
    //         switch (display.value) {
    //           case "loading":
    //             tags.div({}, () => "Loading...")
    //             break
    //           case "error":
    //             tags.div({}, () => "Error")
    //             break
    //           case "success":
    //             tags.div({}, () => "Hello")
    //             break
    //         }
    //       })

    //       select(
    //         () => display,
    //         () => ({
    //           loading() {
    //             tags.div({}, () => "Loading...")
    //           },
    //           error() {
    //             tags.div({}, () => "Error")
    //           },
    //           success() {
    //             tags.div({}, () => "Hello")
    //           },
    //         })
    //       )
    //     })
    //   })

    //   expect(MyComponent).toBeDefined()

    //   render(MyComponent(), document.body)
    //   expect(document.body.innerHTML).not.toContain("Hello")

    //   display.set("success")
    //   expect(document.body.innerHTML).toContain("Hello")

    //   display.set("error")
    //   expect(document.body.innerHTML).not.toContain("Hello")
    // })
})
