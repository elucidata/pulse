import * as React from "react";
import { Computation } from "../internals";
export function observer(Component) {
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
        // Use getter and setter instead of direct assignment
        const prevComputation = Computation.current;
        Computation.current = computationRef.current;
        try {
            renderResult = Component(props);
        }
        finally {
            Computation.current = prevComputation;
        }
        return renderResult;
    };
}
//# sourceMappingURL=observer.js.map