import { describe, expect, it } from "bun:test"
import {
  devTools,
  batch,
  computed,
  Computed,
  effect,
  Effect,
  signal,
  Signal,
  withIdPrefix,
  config,
} from "./core"

config({ mode: "debug" })
const { byId: _registry } = devTools

describe("Signal", () => {
  it("should get the value correctly", () => {
    const mySignal = new Signal(10)
    expect(mySignal.get()).toBe(10)

    mySignal.set(20)
    expect(mySignal.get()).toBe(20)

    expect(_registry.size).toBe(1)
    mySignal.dispose()
    expect(_registry.size).toBe(0)
  })

  it("should set value correctly", () => {
    const mySignal = new Signal(10)
    expect(mySignal.get()).toBe(10)

    mySignal.set(20)
    expect(mySignal.get()).toBe(20)

    expect(_registry.size).toBe(1)
    mySignal.dispose()
    expect(_registry.size).toBe(0)
  })

  it("should notify subscribers when the value changes", () => {
    let value: number | undefined
    const mySignal = new Signal(10)
    const fx = mySignal.subscribe((newValue) => {
      value = newValue
    })

    mySignal.set(20)
    expect(value).toBe(20)

    fx.dispose()
    mySignal.set(44)
    expect(value).toBe(20)

    expect(_registry.size).toBe(1)
    mySignal.dispose()
    expect(_registry.size).toBe(0)
  })

  it("should unsubscribe correctly", () => {
    let value: number | undefined
    const mySignal = new Signal(10)
    const fx = mySignal.subscribe((newValue) => {
      value = newValue
    })

    mySignal.set(20)
    expect(value).toBe(20)

    expect(_registry.size).toBe(2)

    fx.dispose()
    mySignal.set(30)

    expect(value).toBe(20)

    expect(_registry.size).toBe(1)
    mySignal.dispose()
    expect(_registry.size).toBe(0)
  })
})

describe("Effect", () => {
  it("should execute the effect function", () => {
    let executed = false
    const fx = new Effect(() => {
      executed = true
    })

    expect(executed).toBeTrue()

    expect(_registry.size).toBe(1)
    fx.dispose()
    expect(_registry.size).toBe(0)
  })

  it("should execute the effect function only once per change", () => {
    let count = 0
    const mySignal = new Signal(10)

    let fx = new Effect(() => {
      count++
      mySignal.get()
    })

    mySignal.set(20)
    expect(count).toBe(2)
    mySignal.set(30)
    expect(count).toBe(3)

    fx.dispose()
    mySignal.dispose()
    expect(_registry.size).toBe(0)
  })

  it("should dispose the effect", () => {
    let executed = 0
    let mySignal = new Signal(10)

    const fx = new Effect(() => {
      executed += 1
      mySignal.get()
    })

    fx.dispose()
    expect(executed).toBe(1)
    mySignal.set(20)
    expect(executed).toBe(1)
    mySignal.dispose()
    expect(_registry.size).toBe(0)
  })
})

describe("Computed", () => {
  it("should compute the value correctly", () => {
    const mySignal = new Signal(10)
    const myComputed = new Computed(() => mySignal.get() * 2)
    expect(myComputed.get()).toBe(20)

    mySignal.set(5)
    expect(myComputed.get()).toBe(10)

    expect(_registry.size).toBe(2)
    mySignal.dispose()
    myComputed.dispose()
    expect(_registry.size).toBe(0)
  })

  it("should update dependents when dependencies change", () => {
    let value: number | undefined
    const mySignal = withIdPrefix("mySignal", () => new Signal(10))
    const insideMySignal = Signal.internals(mySignal)

    const myComputed = withIdPrefix(
      "myComputed",
      () => new Computed(() => mySignal.get() * 2)
    )
    const insideMyComputed = Computed.internals(myComputed)

    const fx = withIdPrefix("myComputed.subscribeFx", () =>
      myComputed.subscribe((newValue) => {
        value = newValue
      })
    )

    const insideFx = Effect.internals(fx)

    expect(insideMySignal._listeners.size).toBe(1)
    expect(insideMySignal._listeners.has(myComputed)).toBeTrue()

    expect(insideMyComputed._signals.size).toBe(1)
    expect(insideMyComputed._signals.has(mySignal)).toBeTrue()

    expect(insideMyComputed._listeners.size).toBe(1)
    expect(insideMyComputed._listeners.has(fx)).toBeTrue()

    expect(insideFx._signals.size).toBe(1)

    mySignal.set(5)
    expect(value).toBe(10)

    mySignal.dispose()
    myComputed.dispose()
    fx.dispose()
    expect(_registry.size).toBe(0)
  })

  it("should dispose the computed", () => {
    let value: number | undefined
    const mySignal = new Signal<number>(10)
    const myComputed = new Computed(() => mySignal.get() * 2)
    const fx = myComputed.subscribe((newValue) => {
      value = newValue
    })

    mySignal.set(5)
    expect(value).toBe(10)

    fx.dispose()
    mySignal.set(20)
    expect(value).toBe(10)

    expect(_registry.size).toBe(2)
    mySignal.dispose()
    myComputed.dispose()
    expect(_registry.size).toBe(0)
  })

  it("should dispose the computed's open subscriptions", () => {
    let value: number | undefined
    const mySignal = new Signal<number>(10)
    const myComputed = new Computed(() => mySignal.get() * 2)
    myComputed.subscribe((newValue) => {
      value = newValue
    })

    mySignal.set(5)
    expect(value).toBe(10)

    expect(_registry.size).toBe(3)
    myComputed.dispose()
    expect(_registry.size).toBe(1)
    mySignal.dispose()
    expect(_registry.size).toBe(0)
  })

  it("should auto-dispose subscriptions when signal is disposed", () => {
    let value: number | undefined
    const mySignal = new Signal<number>(10)
    const myComputed = new Computed(() => mySignal.get() * 2)
    myComputed.subscribe((newValue) => {
      value = newValue
    })

    mySignal.set(5)
    expect(value).toBe(10)

    expect(_registry.size).toBe(3)
    mySignal.dispose()
    expect(_registry.size).toBe(0)
  })

  it("should support dynamic dependencies", () => {
    let value: number | undefined
    const mySignal = new Signal<number>(10)
    const mySignal2 = new Signal<number>(20)
    const myComputed = new Computed(() => mySignal.get() * mySignal2.get())
    myComputed.subscribe((newValue) => {
      value = newValue
    })

    mySignal.set(5)
    expect(value).toBe(100)

    mySignal2.set(10)
    expect(value).toBe(50)

    mySignal.dispose() // takes the computed and subscription with it
    expect(_registry.size).toBe(1)
    mySignal2.dispose()
    expect(_registry.size).toBe(0)
  })

  it("should unsubscribe from dependencies between runs", () => {
    const mode = new Signal<"simple" | "times">("times")
    const mySignal = new Signal<number>(10)
    const mySignal2 = new Signal<number>(20)
    const myComputed = new Computed(() => {
      if (mode.get() === "simple") {
        return mySignal.get() * 2
      } else {
        return mySignal.get() * mySignal2.get()
      }
    })

    mySignal.set(5)
    expect(myComputed.get()).toBe(100)
    const insideMyComputed = Computed.internals(myComputed)
    expect(insideMyComputed._signals.size).toBe(3)
    expect(insideMyComputed._signals.has(mode)).toBeTrue()
    expect(insideMyComputed._signals.has(mySignal)).toBeTrue()
    expect(insideMyComputed._signals.has(mySignal2)).toBeTrue()

    mode.set("simple")
    expect(myComputed.get()).toBe(10)
    expect(insideMyComputed._signals.size).toBe(2)
    expect(insideMyComputed._signals.has(mySignal)).toBeTrue()
    expect(insideMyComputed._signals.has(mySignal2)).toBeFalse()

    mode.dispose()
    mySignal.dispose()
    mySignal2.dispose()
    expect(_registry.size).toBe(0)
  })
})

describe("Batching", () => {
  it("should batch updates", () => {
    let effectCount = 0
    let subCount = 0
    const mySignal = signal<number>(10)
    const myComputed = computed(() => mySignal.get() * 2)

    mySignal.subscribe(() => {
      subCount++
    })
    expect(subCount).toBe(1)

    effect(() => {
      effectCount++
      myComputed.get()
    })

    mySignal.set(5)
    mySignal.set(5) // Should not notify for the same value
    expect(effectCount).toBe(2)
    expect(subCount).toBe(2)

    mySignal.set(5, true) // Should not notify for the same value, unless forced
    expect(effectCount).toBe(3)
    expect(subCount).toBe(3)

    mySignal.set(10)
    expect(effectCount).toBe(4)

    batch(() => {
      mySignal.set(15)
      mySignal.set(20)
      mySignal.set(50)
    })
    expect(effectCount).toBe(5)
    expect(myComputed.get()).toBe(100)

    mySignal.dispose() // Should dispose the computed and effect

    expect(_registry.size).toBe(0)
  })
})

describe.skip("Signal - Performance", () => {
  it("should handle cycling 100k signals", () => {
    const signals: any[] = []
    for (let i = 0; i < 100_000; i++) {
      signals.push(signal(i))
    }

    for (let i = 0; i < 100_000; i++) {
      signals[i].set(i + 1)
    }

    for (let i = 0; i < 100_000; i++) {
      expect(signals[i].get()).toBe(i + 1)
    }

    expect(_registry.size).toBe(100_000)
    for (let i = 0; i < 100_000; i++) {
      signals[i].dispose()
    }
    expect(_registry.size).toBe(0)
  })
})
