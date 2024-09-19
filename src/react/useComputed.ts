import { useEffect, useRef, useState } from "react"
import { Computation } from "../internals"

export function useComputed<T>(computeFn: () => T): T {
  const [value, setValue] = useState<T>(() => computeFn())
  const computeFnRef = useRef(computeFn)

  // Update the compute function reference
  computeFnRef.current = computeFn

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
