import * as React from "react"
import { ExtractComponentProps, ComponentFunction } from "../view-legacy/types"
import { render } from "../view"
import { render as renderLegacy } from "../view-legacy"

export const PulseComponent = React.memo(function PulseTNGComponent({
  className,
  component,
  props = {},
  ...rest
}: {
  className?: string
  component: (...args: any[]) => any // TODO: Fix this type
  props?: any
}) {
  const divRef = React.useRef<HTMLDivElement | null>(null)
  const disposeRef = React.useRef<Function | null>(null)

  React.useLayoutEffect(
    () => () => {
      divRef.current = null
      disposeRef.current?.()
      disposeRef.current = null
    },
    []
  )

  return React.createElement("div", {
    className,
    style: { display: "contents" },
    ref: (div: HTMLDivElement | null): void => {
      if (!div) return
      divRef.current = div
      if (disposeRef.current) return
      props = { ...props, ...rest }
      disposeRef.current = render(component(props), div)
    },
  })
})

/**
 * @deprecated
 */
export const PulseLegacyComponent = React.memo(function PulseComponent<
  T extends ComponentFunction
>({ component }: { component: T; props: ExtractComponentProps<T> }) {
  const divRef = React.useRef<HTMLDivElement | null>(null)
  const disposeRef = React.useRef<Function | null>(null)

  React.useEffect(
    () => () => {
      divRef.current = null
      disposeRef.current?.()
      disposeRef.current = null
    },
    []
  )

  return React.createElement("div", {
    ref: (div: HTMLDivElement | null) => {
      if (!div) return
      divRef.current = div
      if (disposeRef.current) return
      disposeRef.current = renderLegacy(component, div)
    },
  })
})
