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
  extend: (source: ComponentFunction) => Widget
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
    extend(source: ComponentFunction): Widget {
      return createBuilderProxy(source)
    },
    css: (
      styles: TemplateStringsArray,
      ...expressions: any[]
    ): ComponentFunction => {
      return componentFactory("div", "")(styles, ...expressions)
    },
  } as RootWidget,
  {
    get(target, prop: string) {
      if (prop in target) {
        return (target as any)[prop]
      }
      return createBuilderProxy(prop)
    },
  }
) as RootWidget

function createBuilderProxy(prop: string | ComponentFunction): Widget {
  const tag = prop
  let extraClasses: string[] = []

  const builderProxy: Widget = new Proxy(
    {
      css: (
        styles: TemplateStringsArray,
        ...expressions: any[]
      ): ComponentFunction => {
        return componentFactory(tag, extraClasses.join(" "))(
          styles,
          ...expressions
        )
      },
    },
    {
      get(target, prop: string) {
        if (prop in target) {
          return (target as any)[prop]
        }
        extraClasses.push(prop)
        // Return the same proxy to allow chaining
        return builderProxy
      },
    }
  ) as Widget

  return builderProxy
}

const componentFactory = (
  tag: string | ComponentFunction,
  extraClasses: string
): CssFunction => {
  return (
    styles: TemplateStringsArray,
    ...expressions: any[]
  ): ComponentFunction<{}> & { className: string } => {
    const className = withAutoScope(() => css(styles, ...expressions))
    const classNameWithExtras = `${className} ${extraClasses}`.trim()

    return Object.assign(
      (props: WidgetProps = {}, ...children: any[]) => {
        return h(
          tag,
          Object.assign({}, props, {
            class: classNames(
              props.class ?? props.className ?? "",
              classNameWithExtras,
              props.cssFlags ?? ""
            ),
          }),
          ...children
        )
      },
      {
        className: classNameWithExtras,
      }
    )
  }
}

// const Label = widget.label.BlueBoy.css` color: blue; `
// //@ts-ignore
// console.log("🔵", Label({}, "Hello").outerHTML)

// const RedLabel = widget.extend(Label).RedBoy.css` color: red; `
// //@ts-ignore
// console.log("🔴", RedLabel({}, "Goodbye").outerHTML, RedLabel.toString())
