import * as React from "react"
import {
  Computation,
  getCurrentComputation,
  setCurrentComputation,
} from "../internals"

function observer<P>(Component: React.FC<P>): React.FC<P> {
  return function ObserverComponent(props: P) {
    const [, setVersion] = React.useState(0)

    const computationRef = React.useRef<Computation | null>(null)

    if (!computationRef.current) {
      const computation = new Computation(() => {
        setVersion((v) => v + 1)
      })
      computationRef.current = computation
    }

    React.useEffect(() => {
      return () => {
        computationRef.current?.cleanup()
      }
    }, [])

    let renderResult: React.ReactElement | React.ReactNode | null = null

    // Use getter and setter instead of direct assignment
    const prevComputation = getCurrentComputation()
    setCurrentComputation(computationRef.current)

    try {
      renderResult = Component(props)
    } finally {
      setCurrentComputation(prevComputation)
    }

    return renderResult
  }
}

export { observer }
