import { useEffect, useState } from "react";
export function useObservable(observable, initialValue) {
    const [value, setValue] = useState(initialValue);
    useEffect(() => {
        const unsubscribe = observable.subscribe(setValue);
        return unsubscribe;
    }, [observable]);
    return value;
}
//# sourceMappingURL=useObservable.js.map