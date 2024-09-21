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
      disposeRef.current = render(component, div)
      console.log("[PulseComponent] mounted", typeof disposeRef.current)
    },
  })
})

// return (
//   <div>
//     <div
//       ref={(div) => {
//         if (!div) {
//           return // disposeRef.current?.()
//         }
//         divRef.current = div
//         disposeRef.current = render(component, div)
//       }}
//     />
//     <button
//       onClick={() => {
//         disposeRef.current?.()
//         disposeRef.current = null
//       }}
//     >
//       KILL
//     </button>
//     <button
//       onClick={() => {
//         if (!divRef.current || !!disposeRef.current) {
//           return console.log("Component already mounted, or missing div")
//         }
//         disposeRef.current = render(component, divRef.current!)
//       }}
//     >
//       REMOUNT
//     </button>
//   </div>
// )
