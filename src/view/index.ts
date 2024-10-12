export * from "../index"
export { classNames, css } from "./css"
export {
  ExtractProps,
  ReactiveValue,
  each,
  getEnv,
  live,
  onDispose,
  raw,
  render,
  setEnv,
  tags,
  text,
  view,
  when,
  getValue,
  bindValue,
} from "./internals"

import * as Internals from "./internals"

export type Modifiers<T extends HTMLElement> = Internals.BaseModifiers<T>

export type View<P> = Pick<
  Internals.View<P>,
  "id" | "parent" | "props" | "children"
>

export type ViewFactory<P> = Internals.ViewFactory<P>

export function isView(value: any): value is View<any> {
  return value instanceof Internals.View
}

export function isViewFactory(value: any): value is ViewFactory<any> {
  return typeof value === "function" && Internals.PulseViewFactory in value
}
