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
  const [value, setValue] = useState(() => signal.get())
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
    signals.map((signal) => signal.get())
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
export function experimental_withSignalTracking<T>(
  Component: React.FunctionComponent<T>
) {
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
