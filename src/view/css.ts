const HOST_SYMBOL = ":host"
const HOST_REGEX = new RegExp(HOST_SYMBOL, "g")

let autoScopeStyles = false
let validateCss = true

export const withAutoScope = <T>(worker: () => T) => {
  const prev = autoScopeStyles
  autoScopeStyles = true
  const result = worker()
  autoScopeStyles = prev
  return result
}

export const withoutValidation = <T>(worker: () => T) => {
  const prev = validateCss
  validateCss = false
  const result = worker()
  validateCss = prev
  return result
}

/**
 * A simple CSS-in-JS implementation that generates unique class names for
 * styles and applies them to the document. This implementation is intended
 * for use in a browser context.
 */

/** Cache for generated styles, useful if you want to extract elsewhere. */
export const styleCache = new Map<string, string>()

/**
 * Generate a unique class name from the given CSS styles (a hash of the styles)
 * and replace all instances of `:host` with the generated class name. If used
 * in a browser context, the styles will be applied to the document. All styles
 * are cached (see styleCache), so the styles will only be applied once. If you
 * omit the `:host` selector, it will be added around the styles automatically.
 * @returns Generated class name
 */
export function css(
  styles: TemplateStringsArray,
  ...expressions: any[]
): string {
  let styleString = styles.reduce((acc, curr, idx) => {
    return acc + curr + (expressions[idx] || "")
  }, "")

  styleString = styleString.trim()
  if (autoScopeStyles && !styleString.startsWith(HOST_SYMBOL)) {
    styleString = `${HOST_SYMBOL} { ${styleString} }`
  }

  const hash = crcHash(styleString)
  const className = `css-${hash}`
  const updatedStyles = styleString.replace(HOST_REGEX, `.${className}`)

  if (validateCss) {
    assertValidCSS(updatedStyles)
  }

  applyStyles(className, updatedStyles)

  return className
}

type Truthy = string | number | boolean | null | undefined
type ClassValue = string | Record<string, Truthy> | undefined | null | false

/**
 * Accumulate class names from the given arguments. If an argument is an object,
 * it will be treated as a map of class names to boolean values, where only the
 * keys with truthy values will be included.
 */
export function classNames(...classes: ClassValue[]): string {
  return classes
    .map((cls) => {
      if (typeof cls === "string" && cls !== "") {
        return cls.trim()
      } else if (typeof cls === "object" && cls !== null) {
        return Object.entries(cls)
          .filter(([, value]) => value)
          .map(([key]) => String(key).trim())
          .join(" ")
      } else {
        return ""
      }
    })
    .filter(Boolean)
    .join(" ")
    .trim()
}

function crcHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

export function applyStyles(className: string, styles: string): void {
  if (styleCache.has(className)) {
    return //console.debug("Styles already applied", className)
  }
  styleCache.set(className, styles)
  applyStylesToDOM(styles)
}

export function applyStylesToDOM(styles: string): boolean {
  const target = getStyleParent()
  if (!target || !document) {
    return false
  }
  // if target != null, it's implied that document is available
  if ("adoptedStyleSheets" in document) {
    const style = new CSSStyleSheet()
    style.replaceSync(styles)
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, style]
  } else {
    const style = (document as any).createElement("style")
    style.textContent = styles
    target.appendChild(style)
  }
  return true
}

/** Returns the mount target for styles, or null if not in a document context. */
function getStyleParent(): HTMLElement | null {
  if (typeof document === "undefined") {
    // console.warn("No document found")
    return null
  }
  return document.head || document.body
}

function assertValidCSS(styles: string) {
  // Validate that the number of closing brackets matches the number of opening brackets
  let openBrackets = 0
  let closeBrackets = 0
  for (let i = 0; i < styles.length; i++) {
    if (styles[i] === "{") openBrackets++
    else if (styles[i] === "}") closeBrackets++
  }
  if (openBrackets !== closeBrackets) {
    throw new Error("Invalid CSS: Bracket mismatch.")
  }
}
