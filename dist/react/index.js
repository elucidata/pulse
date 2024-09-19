import "../chunk-H6Z3WHYR.js";
import {
  Computation,
  Signal,
  batch,
  computed,
  effect,
  getCurrentComputation,
  setCurrentComputation,
  signal
} from "../chunk-KVACTCNH.js";

// src/react/observer.ts
import * as React from "react";
function observer(Component) {
  return function ObserverComponent(props) {
    const [, setVersion] = React.useState(0);
    const computationRef = React.useRef(null);
    if (!computationRef.current) {
      const computation = new Computation(() => {
        setVersion((v) => v + 1);
      });
      computationRef.current = computation;
    }
    React.useEffect(() => {
      return () => {
        computationRef.current?.cleanup();
      };
    }, []);
    let renderResult = null;
    const prevComputation = getCurrentComputation();
    setCurrentComputation(computationRef.current);
    try {
      renderResult = Component(props);
    } finally {
      setCurrentComputation(prevComputation);
    }
    return renderResult;
  };
}

// src/react/useComputed.ts
import { useState as useState2, useRef as useRef2, useEffect as useEffect2 } from "react";
function useComputed(computeFn) {
  const [value, setValue] = useState2(() => computeFn());
  const computeFnRef = useRef2(computeFn);
  computeFnRef.current = computeFn;
  const computationRef = useRef2(null);
  useEffect2(() => {
    const computation = new Computation(() => {
      const newValue = computeFnRef.current();
      setValue(newValue);
    });
    computationRef.current = computation;
    return () => {
      computation.cleanup();
      computationRef.current = null;
    };
  }, []);
  return value;
}
export {
  Signal,
  batch,
  computed,
  effect,
  observer,
  signal,
  useComputed
};
