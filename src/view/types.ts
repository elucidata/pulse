// Type definitions for JSX compatibility
declare global {
  namespace JSX {
    interface IntrinsicElements {
      //@ts-ignore
      [elemName: string]: any
    }
    interface Element extends HTMLElement {}
    //@ts-ignore
    interface ElementClass {
      //@ts-ignore
      render: () => HTMLElement
    }
  }
}

// Helper types
export type PropsWithChildren = { [key: string]: any; children?: any }
export type ComponentFunction<P = any> = (
  props?: P,
  children?: any
) => HTMLElement | HTMLElement[] | Node | Node[]

// Helper type to extract the props of a component function
export type ComponentProps<F> = F extends ComponentFunction<infer P> ? P : never