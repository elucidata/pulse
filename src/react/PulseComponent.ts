import * as React from "react"
import { ExtractComponentProps, ComponentFunction } from "../view/types"
import { render } from "../view"

export const PulseComponent = React.memo(function PulseComponent<
  T extends ComponentFunction
>({ component }: { component: T; props: ExtractComponentProps<T> }) {
  const divRef = React.useRef<HTMLDivElement | null>(null)
  const disposeRef = React.useRef<Function | null>(null)

  React.useEffect(
    () => () => {
      console.log("[PulseComponent] unmounting", typeof disposeRef.current)
      divRef.current = null
      disposeRef.current?.()
      disposeRef.current = null
    },
    []
  )

  return React.createElement("div", {
    ref: (div: HTMLDivElement | null) => {
      if (!div) {
        return console.log("[PulseComponent] ref: div is null")
      }
      divRef.current = div
      if (disposeRef.current) {
        return console.warn("[PulseComponent] already mounted")
      }
      disposeRef.current = render(component, div)
      console.log("[PulseComponent] mounted", typeof disposeRef.current)
    },
  })
})
