declare global {
    namespace JSX {
        interface IntrinsicElements {
            [elemName: string]: any;
        }
        interface Element extends HTMLElement {
        }
        interface ElementClass {
            render: () => HTMLElement;
        }
    }
}
export type Props = {
    [key: string]: any;
};
export type ComponentFunction<P = Props> = (props?: P, children?: any) => Node | Node[];
export type ExtractComponentProps<F> = F extends ComponentFunction<infer P> ? P : never;
