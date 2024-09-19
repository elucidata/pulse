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
type PropsWithChildren = {
    [key: string]: any;
    children?: any;
};
type ComponentFunction = (props?: any, children?: any) => HTMLElement;

declare function setContext(key: any, value: any): void;
declare function getContext<T>(key: any): T;
declare function onMount(fn: () => void): void;
declare function onUnmount(fn: () => void): void;
declare function h(tag: string | ComponentFunction, props: PropsWithChildren | null, ...children: any[]): HTMLElement;
declare function render(component: ComponentFunction, container: HTMLElement): () => void;

declare const html: (strings: TemplateStringsArray, ...values: any[]) => HTMLElement | HTMLElement[];

export { type ComponentFunction, type PropsWithChildren, getContext, h, html, onMount, onUnmount, render, setContext };
