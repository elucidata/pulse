import { Signal, Computed } from './index.js';
export { Effect, batch, computed, config, devTools, dispose, effect, isComputed, isEffect, isSignal, signal, withIdPrefix } from './index.js';
export { persistedSignal, update } from './with-utils.js';
import React from 'react';

type Readable<T> = Signal<T> | Computed<T>;
declare function useComputed<T>(computeFn: () => T): T;
declare function useSignalEffect(effectFn: () => (() => void) | void): void;
declare function useSignalValue<T>(signal: Readable<T>): T;
declare function useSignalValues<T extends any[]>(...signals: Readable<T[number]>[]): T;
/**
 * Higher-order function that wraps a React component
 *
 * # IMPORTANT NOTE:
 * This function gets called out of rendering, so it can't
 * use hooks or other React features that require being
 * called inside a component's render function.
 */
declare function experimental_withSignalTracking<T>(Component: React.FunctionComponent<T>): (props: T) => React.CElement<any, React.Component<any, any, any>>;

export { Computed, Signal, experimental_withSignalTracking, useComputed, useSignalEffect, useSignalValue, useSignalValues };
