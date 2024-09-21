import { classNames, css, withAutoScope } from "./css"
import { h } from "./runtime"
import { ComponentFunction } from "./types"

type WidgetProps = {
  class?: string
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

const cssTagBuilder = (tag: string, extraClasses: string): CssFunction => {
  return (
    styles: TemplateStringsArray,
    ...expressions: any[]
  ): ComponentFunction<{}> & { className: string } => {
    const className = withAutoScope(() => css(styles, ...expressions))

    // Combine extra classes with the generated class name
    const classNameWithExtras = `${className} ${extraClasses}`.trim()

    return Object.assign(
      (props: WidgetProps, children: any[]) => {
        return h(
          tag,
          {
            ...props,
            class: classNames(
              props.class ?? "",
              classNameWithExtras,
              props.cssFlags ?? ""
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

/**
 * A proxy object that allows to build a widget tree with CSS-in-JS support.
 * The proxy object has a property for each HTML tag, and each property is a
 * proxy object that allows to chain CSS classes.
 *
 */
export const widget: RootWidget = new Proxy(
  {
    extend() {
      // throw new Error("Not implemented")
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

      // Create the inner proxy
      const innerProxy: Widget = new Proxy(innerWidget as Widget, {
        get(innerTarget, innerProp: string) {
          if (innerProp in innerTarget) {
            return (innerTarget as any)[innerProp]
          }
          // Accumulate extra classes
          extraClasses += ` ${innerProp}`
          // Return the same proxy to allow chaining
          return innerProxy
        },
      }) as Widget

      return innerProxy
    },
  }
) as RootWidget

// const Widget = widget.div.css`
//   display: flex;
//  `

// widget.div.isCrap

// widget.div.isIt.Good.css` color: blue; `

// Example usage
// const Root = widget.div.css`
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   justify-content: center;
//   height: 100vh;

//   h1 {
//     font-size: 2rem;
//     margin-bottom: 1rem;
//   }
// `

// const x = widget.css``
// const y = widget.section.css``
