export * from "./index"
export * from "./with-utils"

import React, { createElement, useEffect, useMemo, useState } from "react"
import {
  computed,
  effect,
  TrackingContext,
  Signal,
  Computed,
  uid,
} from "./core"

type Readable<T> = Signal<T> | Computed<T>

export function useComputed<T>(computeFn: () => T): T {
  const derived = useMemo(() => computed(computeFn), [])
  useEffect(() => () => derived.dispose(), [derived])
  return useSignalValue(derived)
}

export function useSignalEffect(effectFn: () => (() => void) | void) {
  useEffect(() => {
    const fx = effect(() => effectFn())
    return () => fx.dispose()
  }, [])
}

export function useSignalValue<T>(signal: Readable<T>): T {
  const [value, setValue] = useState(() => signal.peek())
  useEffect(() => {
    const fx = signal.subscribe((v) => {
      setValue(v)
    })
    return () => fx.dispose()
  }, [signal])
  return value
}

export function useSignalValues<T extends any[]>(
  ...signals: Readable<T[number]>[]
): T {
  const [values, setValues] = useState(() =>
    signals.map((signal) => signal.peek())
  )
  useEffect(() => {
    const effects = signals.map((signal, i) =>
      signal.subscribe((value) => {
        setValues((prev: any) => {
          const next = prev.slice()
          next[i] = value
          return next
        })
      })
    )
    return () => {
      effects.forEach((fx) => fx.dispose())
    }
  }, signals)
  return values as T
}

/**
 * Higher-order function that wraps a React component
 *
 * # IMPORTANT NOTE:
 * This function gets called out of rendering, so it can't
 * use hooks or other React features that require being
 * called inside a component's render function.
 */
export function withSignalTracking<T>(Component: React.FunctionComponent<T>) {
  return function WrappedComponent(props: T) {
    const [_, setRenderTrigger] = useState({})

    useEffect(() => {
      function trackSignals() {
        TrackingContext.run(
          {
            id: "TC" + uid(),
            _signalChanged() {
              setRenderTrigger({})
            },

            _trackSignal() {},
            _untrackSignal() {},
            dispose() {},
          } as any,
          () => {
            // This is kind of a hack to force the component to render
            // and track signals accessed during the render. This is
            // necessary because the component is not rendered inside
            // the trackSignals function, so it won't automatically
            // track the signals accessed during the render.
            // This is a temporary workaround until we can find a better
            // solution.
            Component(props)
          }
        )

        // Clean up the signal subscriptions when the component unmounts
        return () => {}
      }

      // Execute the signal tracking and re-rendering logic
      const unsubscribe = trackSignals()

      // Clean up the signal subscriptions when the component unmounts
      return () => {
        unsubscribe()
      }
    }, [Component, props])

    // Render the wrapped component
    return createElement(Component as any, props as any) // <Component {...props} />
  }
}

// import React from "react"

// // Higher-order function that wraps a React component
// function withSignalTracking<T>(Component: React.ComponentType<T>) {
//   return function WrappedComponent(props: T) {
//     const [_, setRenderTrigger] = useState({})

//     useEffect(() => {
//       // Subscribe to the signals accessed in the wrapped component's render method
//       const signalSubscriptions = new Set<() => void>()

//       function trackSignals() {
//         // Access the signals in the wrapped component's render method
//         const signalsAccessed = new Set<() => void>()
//         currentReference = () => {
//           signalsAccessed.forEach((signal) => {
//             signalSubscriptions.add(
//               signal.subscribe(() => {
//                 // Trigger a re-render when any of the accessed signals change
//                 setRenderTrigger({})
//               })
//             )
//           })
//         }
//         Component(props)
//         currentReference = null

//         // Clean up the signal subscriptions when the component unmounts
//         return () => {
//           signalSubscriptions.forEach((unsubscribe) => {
//             unsubscribe()
//           })
//         }
//       }

//       // Execute the signal tracking and re-rendering logic
//       executeEffects()
//       const unsubscribe = trackSignals()
//       executeEffects()

//       // Clean up the signal subscriptions when the component unmounts
//       return () => {
//         unsubscribe()
//       }
//     }, [Component, props])

//     // Render the wrapped component
//     return React.createElement(Component, props)// <Component {...props} />
//   }
// }

// Higher-Order Component (HOC) for automatic signal tracking
// export function withAutoSignalTrackingOld<P>(
//   WrappedComponent: React.ComponentType<P>
// ): React.FC<P> {
//   return function AutoSignalTrackedComponent(props: P) {
//     // State used to force re-rendering
//     const [, setSignalVersion] = useState(0)
//     const signalDependencies = useRef<Set<() => void>>(new Set())

//     // Effect for subscribing to signal updates
//     useEffect(() => {
//       const unsubscribeFunctions: (() => void)[] = []

//       // Subscribe to all signals that were accessed during the render
//       signalDependencies.current.forEach((subscribe) => {
//         console.log("🔴 Subscribing to signal?")
//         const unsubscribe = subscribe()
//         unsubscribeFunctions.push(unsubscribe as any)
//       })

//       // Cleanup subscriptions on component unmount
//       return () => {
//         unsubscribeFunctions.forEach((unsubscribe) => unsubscribe())
//       }
//     }, [])

//     // Rendering with signal tracking
//     function trackSignals() {
//       signalDependencies.current.clear()

//       const track = () => {
//         setSignalVersion((prev) => prev + 1)
//       }

//       const previousReference = currentReference
//       currentReference = track

//       console.log("🟢 Tracking signals", { WrappedComponent, props })

//       // const element = React.createElement(WrappedComponent as any, props as any) // <WrappedComponent {...props} />
//       //@ts-ignore
//       const element = <WrappedComponent {...props} />

//       console.log("🟠 DONE Tracking signals", { WrappedComponent, props })

//       currentReference = previousReference

//       return element
//     }

//     // Render the wrapped component with tracked signals
//     return trackSignals()
//   }
// }

// // Custom hook for automatic signal tracking
// function useSignalTracking() {
//   const [, setSignalVersion] = useState(0)
//   const signalDependencies = useRef<Set<() => void>>(new Set())

//   useEffect(() => {
//     const unsubscribeFunctions: (() => void)[] = []

//     // Subscribe to all tracked signals
//     signalDependencies.current.forEach((subscribe) => {
//       const unsubscribe = subscribe()
//       unsubscribeFunctions.push(unsubscribe as any)
//     })

//     // Cleanup subscriptions on unmount
//     return () => {
//       unsubscribeFunctions.forEach((unsubscribe) => unsubscribe())
//     }
//   }, [])

//   function trackSignals<T>(renderFn: () => T): T {
//     signalDependencies.current.clear()

//     const track = () => {
//       setSignalVersion((prev) => prev + 1)
//     }

//     const previousReference = currentReference
//     currentReference = track

//     console.log("🟢 Tracking signals")
//     const result = renderFn() // Render the component or logic that accesses signals
//     console.log("🟠 DONE Tracking signals")

//     currentReference = previousReference

//     return result
//   }

//   return trackSignals
// }

// // Higher-Order Component (HOC) for automatic signal tracking
// export function withAutoSignalTracking<P>(
//   WrappedComponent: React.ComponentType<P>
// ): React.FC<P> {
//   return function AutoSignalTrackedComponent(props: P) {
//     const trackSignals = useSignalTracking()

//     // Wrap the component render inside the trackSignals function
//     //@ts-ignore
//     return trackSignals(() => <WrappedComponent {...props} />)
//   }
// }

// // Custom hook for automatic signal tracking
// function useSignalTracking() {
//   const [, setSignalVersion] = useState(0)
//   const signalDependencies = useRef<Set<() => void>>(new Set())

//   useEffect(() => {
//     const unsubscribeFunctions: (() => void)[] = []

//     // Subscribe to all tracked signals
//     signalDependencies.current.forEach((subscribe) => {
//       const unsubscribe = subscribe()
//       unsubscribeFunctions.push(unsubscribe as any)
//     })

//     // Cleanup subscriptions on unmount
//     return () => {
//       unsubscribeFunctions.forEach((unsubscribe) => unsubscribe())
//     }
//   })

//   function trackSignals<T>(renderFn: () => T): T {
//     // Clear previous dependencies
//     signalDependencies.current.clear()

//     // Track signal access and force a re-render when they change
//     const track = () => {
//       console.log("Signal change detected, re-rendering...")
//       setSignalVersion((prev) => prev + 1)
//     }

//     // Temporarily set the currentReference to the track function
//     const previousReference = currentReference
//     currentReference = () => {
//       signalDependencies.current.add(track)
//     }

//     console.log("🟢 Tracking signals")
//     const result = renderFn() // Render the component or logic that accesses signals
//     console.log("🟠 DONE Tracking signals")

//     // Restore previous currentReference
//     currentReference = previousReference

//     return result
//   }

//   return trackSignals
// }

// // Higher-Order Component (HOC) for automatic signal tracking
// export function withAutoSignalTracking<P>(
//   WrappedComponent: React.ComponentType<P>
// ): React.FC<P> {
//   return function AutoSignalTrackedComponent(props: P) {
//     const trackSignals = useSignalTracking()

//     // Wrap the component render inside the trackSignals function
//     //@ts-ignore
//     return trackSignals(() => <WrappedComponent {...props} />)
//   }
// }
