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
export type Props = { [key: string]: any }
export type ComponentFunction<P = Props> = (
    props?: P,
    children?: any
) => Node | Node[]

// Helper type to extract the props of a component function
export type ExtractComponentProps<F> = F extends ComponentFunction<infer P>
    ? P
    : never
