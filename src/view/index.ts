export * from "../index"
export { classNames, css } from "./css"
export {
  ExtractProps,
  ReactiveValue,
  bindValue,
  context,
  each,
  env,
  getValue,
  live,
  onDispose,
  raw,
  render,
  tags,
  text,
  view,
  when,
  customPulseElement,
} from "./internals"

import * as Internals from "./internals"

export type Modifiers<T extends HTMLElement> = Internals.BaseModifiers<T>

export type View<P> = Pick<
  Internals.View<P>,
  "id" | "parent" | "props" | "children"
>

export type ViewFactory<P> = Internals.ViewFactory<P>

export function isView(value: any): value is View<any> {
  return typeof value === "object" && Internals.PulseView in value
}

export function isViewFactory(value: any): value is ViewFactory<any> {
  return typeof value === "function" && Internals.PulseViewFactory in value
}
