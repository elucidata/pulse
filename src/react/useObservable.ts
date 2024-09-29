import { useEffect, useState } from "react"
import { Observable } from "../utils/observables"

export function useObservable<T>(
    observable: Observable<T>,
    initialValue?: T
): T {
    const [value, setValue] = useState(initialValue)

    useEffect(() => {
        const unsubscribe = observable.subscribe(setValue)
        return unsubscribe
    }, [observable])

    return value!
}
