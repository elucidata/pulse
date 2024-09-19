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
type PropsWithChildren = {
    [key: string]: any;
    children?: any;
};
type ComponentFunction = (props?: any, children?: any) => HTMLElement | HTMLElement[] | Node | Node[];

declare function setContext(key: any, value: any): void;
declare function getContext<T>(key: any): T;
declare function onMount(fn: () => void): void;
declare function onUnmount(fn: () => void): void;
declare function h(tag: string | ComponentFunction, props: PropsWithChildren | null, ...children: any[]): Node;
declare function render(component: ComponentFunction, container: HTMLElement): () => void;

export { type ComponentFunction, type PropsWithChildren, getContext, h, onMount, onUnmount, render, setContext };
