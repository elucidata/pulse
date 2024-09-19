export { Signal, batch, computed, effect, signal } from '../index.js';
export { html } from './html.js';

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
type Props = {
    [key: string]: any;
};
type ComponentFunction<P = Props> = (props?: P, children?: any) => HTMLElement | HTMLElement[] | Node | Node[];
type ComponentProps<F> = F extends ComponentFunction<infer P> ? P : never;

declare function setContext(key: any, value: any): void;
declare function getContext<T>(key: any): T;
declare function onMount(fn: () => void | (() => void)): void;
declare function onUnmount(fn: () => void): void;
declare function h(tag: string | ComponentFunction, props: Props | null, ...children: any[]): Node;
declare function render(component: ComponentFunction, container: HTMLElement): () => void;

export { type ComponentFunction, type ComponentProps, type Props, getContext, h, onMount, onUnmount, render, setContext };
