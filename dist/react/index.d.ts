export { Signal, batch, computed, effect, signal } from '../index.js';
import * as React from 'react';
import { O as Observable } from '../observables-DDRY84OV.js';

declare function observer<P>(Component: React.FC<P>): React.FC<P>;

declare function useComputed<T>(computeFn: () => T): T;

declare function useObservable<T>(observable: Observable<T>, initialValue?: T): T;

export { observer, useComputed, useObservable };
