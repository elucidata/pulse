export { S as Signal, b as batch, c as computed, e as effect, s as signal } from '../index-CP5b4Fzw.js';
import * as React from 'react';
import { O as Observable } from '../observables-CSEetSGk.js';

declare function observer<P>(Component: React.FC<P>): React.FC<P>;

declare function useComputed<T>(computeFn: () => T): T;

declare function useObservable<T>(observable: Observable<T>, initialValue?: T): T;

export { observer, useComputed, useObservable };
