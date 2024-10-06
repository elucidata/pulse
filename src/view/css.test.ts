import { describe, it, expect, beforeEach, mock, jest, spyOn } from "bun:test"

import { css, styleCache, withAutoScope, classNames } from "./css"

const expectStyleToContain = (className: string, style: string) => {
  if (document.adoptedStyleSheets) {
    const styleSheet = document.adoptedStyleSheets[0] as CSSStyleSheet
    expect(styleSheet.cssRules[0].cssText).toContain(
      `.${className} { ${style} }`
    )
  } else {
    const styleElement = document.head.querySelector("style")
    expect(styleElement).not.toBeNull()
    expect(styleElement!.textContent).toContain(`.${className} { ${style} }`)
  }
}

describe("css function", () => {
  beforeEach(() => {
    styleCache.clear()
    document.adoptedStyleSheets = []
    document.head.innerHTML = ""
  })

  it("should generate a unique class name", () => {
    const className = css`
      color: red;
    `
    expect(className).toMatch(/^css-[\-]?\d+$/)
  })

  it("should apply the styles to the document", () => {
    const className = withAutoScope(
      () => css`
        color: red;
      `
    )
    expectStyleToContain(className, "color: red;")
  })

  it("should replace :host with the generated class name", () => {
    const className = css`
      :host {
        color: red;
      }
    `
    expectStyleToContain(className, "color: red;")
  })

  it("should cache the generated styles", () => {
    const className = css`
      color: red;
    `
    expect(styleCache.has(className)).toBe(true)
    expect(styleCache.get(className)).toContain("color: red;")
  })

  it("should throw if css is invalid (imbalanced brackets)", () => {
    expect(() => {
      css`
        :host {
          color: red;
        }
      `
    }).not.toThrow()

    expect(() => {
      css([
        `
        :host {
          color: red;
        }}
      `,
      ] as any)
    }).toThrow("Invalid CSS: Bracket mismatch.")
  })

  it("should not apply styles more than once", () => {
    // const consoleWarnSpy = spyOn(console, "debug").mockImplementation(() => {})
    const className = css`
      :host {
        color: red;
      }
    `
    css`
      :host {
        color: red;
      }
    ` // Apply the same styles again

    expect(styleCache.size).toBe(1)

    // expect(consoleWarnSpy).toHaveBeenCalledWith(
    //   "Styles already applied",
    //   className
    // )
    // consoleWarnSpy.mockRestore()
  })

  it("should handle expressions in the styles", () => {
    const color = "blue"
    const className = css`
      :host {
        color: ${color};
      }
    `

    expectStyleToContain(className, "color: blue;")
  })
})

describe("classNames function", () => {
  it("should return a string with all the class names", () => {
    const result = classNames("class1", "class2", "class3")
    expect(result).toBe("class1 class2 class3")
  })

  it("should ignore falsy values", () => {
    const result = classNames("class1", false, "class2", null, "class3")
    expect(result).toBe("class1 class2 class3")
  })

  it("should ignore empty strings", () => {
    const result = classNames("class1", "", "class2", "class3")
    expect(result).toBe("class1 class2 class3")
  })

  it("should handle objects", () => {
    const result = classNames("class1", { class2: true, class3: false })
    expect(result).toBe("class1 class2")
  })
})
