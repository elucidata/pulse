import { useEffect, useMemo, useRef, useState } from "react"
import { Computation, ISignal, isSignal } from "../internals"

export function useComputed<T>(computeFn: (() => T) | ISignal<T>): T {
  const wrapper = useMemo<() => T>(() => {
    if (isSignal(computeFn)) {
      return () => computeFn.get()
    }
    return computeFn
  }, [computeFn])
  const [value, setValue] = useState<T>(() => wrapper())
  const computeFnRef = useRef(wrapper)

  // Update the compute function reference
  computeFnRef.current = wrapper

  const computationRef = useRef<Computation | null>(null)

  useEffect(() => {
    const computation = new Computation(() => {
      const newValue = computeFnRef.current()
      setValue(newValue)
    })

    computationRef.current = computation

    return () => {
      computation.cleanup()
      computationRef.current = null
    }
  }, [])

  return value
}
