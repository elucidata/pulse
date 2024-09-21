import { classNames, css, withAutoScope } from "./css"
import { h } from "./runtime"
import { ComponentFunction } from "./types"

type WidgetProps = {
  class?: string
  className?: string
  cssFlags?: any
}

type CssFunction<T = {}> = (
  styles: TemplateStringsArray,
  ...expressions: any[]
) => ComponentFunction<WidgetProps & T> & { className: string }

type RootWidget = {
  css: CssFunction
  extend: () => void
} & {
  [K in keyof HTMLElementTagNameMap]: Widget
}

type Widget = { css: CssFunction } & { [key: string]: Widget }

/**
 * The `widget` object is a proxy-based utility for creating styled components with dynamic tags and class names.
 *
 * Usage:
 *
 * ```typescript
 * widget.[tagname].[extraClassnames*].css`styles`
 * ```
 *
 * - `[tagname]`: Optional HTML tag name to be used for the component (defaults to `div`).
 * - `[extraClassnames*]`: Optional additional class names to be appended to the component.
 * - `css`: A tagged template function to define the component's styles.
 *
 * Example:
 *
 * ```typescript
 * const styledDiv = widget.div.myClass.anotherClass.css`
 *   color: red;
 *   background: blue;
 * `;
 * ```
 *
 * This will create a `div` element with the classes `myClass` and `anotherClass`, and apply the specified styles.
 */
export const widget: RootWidget = new Proxy(
  {
    extend() {
      // TODO: Accept a ComponentFunction to extend the widget object instead of a tag name
      // EXAMPLE: widget.extend(Label).ExtraClass.css` color: red; `
    },
    css: (
      styles: TemplateStringsArray,
      ...expressions: any[]
    ): ComponentFunction => {
      return cssTagBuilder("div", "")(styles, ...expressions)
    },
  } as RootWidget,
  {
    get(target, prop: string) {
      if (prop in target) {
        return (target as any)[prop]
      }
      const tag = prop
      let extraClasses = ""

      const innerWidget = {
        css: (
          styles: TemplateStringsArray,
          ...expressions: any[]
        ): ComponentFunction => {
          return cssTagBuilder(tag, extraClasses)(styles, ...expressions)
        },
      }

      const innerProxy: Widget = new Proxy(innerWidget as Widget, {
        get(innerTarget, innerProp: string) {
          if (innerProp in innerTarget) {
            return (innerTarget as any)[innerProp]
          }
          extraClasses += ` ${innerProp}`
          // Return the same proxy to allow chaining
          return innerProxy
        },
      }) as Widget

      return innerProxy
    },
  }
) as RootWidget

const cssTagBuilder = (tag: string, extraClasses: string): CssFunction => {
  return (
    styles: TemplateStringsArray,
    ...expressions: any[]
  ): ComponentFunction<{}> & { className: string } => {
    const className = withAutoScope(() => css(styles, ...expressions))
    const classNameWithExtras = `${className} ${extraClasses}`.trim()

    return Object.assign(
      (props: WidgetProps = {}, children: any[]) => {
        return h(
          tag,
          {
            ...props,
            ["class"]: classNames(
              props?.["class"] ?? props?.className ?? "",
              classNameWithExtras,
              props?.cssFlags ?? ""
            ),
          },
          ...children
        )
      },
      {
        className: classNameWithExtras,
      }
    )
  }
}
