import { EffectFunction } from "../internals";
import { ComponentFunction, Props } from "./types";
export declare function effect(fn: EffectFunction): void;
export declare const contextStack: Map<any, any>[];
export declare function setContext(key: any, value: any): void;
export declare function getContext<T>(key: any): T;
export declare const cleanupStack: (() => void)[][];
export declare function onMount(fn: () => void | (() => void)): void;
export declare function onUnmount(fn: () => void): void;
export declare function h(tag: string | ComponentFunction, props: Props | null, ...children: any[]): Node;
export declare function appendChild(parent: Node, child: any, disposes?: (() => void)[]): void;
export declare function createComponent(component: ComponentFunction, props: any, children: any[]): {
    node: Node;
    dispose: () => void;
};
export declare function render(component: ComponentFunction, container: HTMLElement): () => void;
