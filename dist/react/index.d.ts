export { Signal, batch, computed, effect, signal } from '../index.js';
import * as React from 'react';

declare function observer<P>(Component: React.FC<P>): React.FC<P>;

declare function useComputed<T>(computeFn: () => T): T;

export { observer, useComputed };
