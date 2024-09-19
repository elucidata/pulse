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
export type ComponentFunction = (
  props?: any,
  children?: any
) => HTMLElement | HTMLElement[] | Node | Node[]
