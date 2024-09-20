import { useEffect, useRef, useState } from "react";
import { Computation } from "../internals";
export function useComputed(computeFn) {
    const [value, setValue] = useState(() => computeFn());
    const computeFnRef = useRef(computeFn);
    // Update the compute function reference
    computeFnRef.current = computeFn;
    const computationRef = useRef(null);
    useEffect(() => {
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
//# sourceMappingURL=useComputed.js.map