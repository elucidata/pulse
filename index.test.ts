import { describe, it, expect } from "bun:test"
import { signal, computed, effect, batch } from "./index"
import { devTools, config } from "./core"

config({ mode: "debug" })
const { byId: _registry } = devTools

describe("Signal", () => {
  it("should set and get the value correctly", () => {
    const mySignal = signal(10)
    expect(mySignal.get()).toBe(10)

    mySignal.set(20)
    expect(mySignal.get()).toBe(20)

    mySignal.dispose()
  })

  it("should notify subscribers when the value changes", () => {
    let value: number | undefined
    const mySignal = signal(10)
    mySignal.subscribe((newValue) => {
      value = newValue
    })

    mySignal.set(20)
    expect(value).toBe(20)

    mySignal.set(44)
    expect(value).toBe(44)

    mySignal.dispose()
  })

  it("should unsubscribe correctly", () => {
    let value: number | undefined
    const mySignal = signal(10)
    const fx = mySignal.subscribe((newValue) => {
      value = newValue
    })

    mySignal.set(20)
    expect(value).toBe(20)

    fx.dispose()
    mySignal.set(30)
    expect(value).toBe(20)

    mySignal.dispose()
  })
})

describe("Computed", () => {
  it("should compute the value correctly", () => {
    const mySignal = signal<number>(10)
    const myComputed = computed(() => mySignal.get() * 2)
    expect(myComputed.get()).toBe(20)

    mySignal.set(5)
    expect(myComputed.get()).toBe(10)

    mySignal.dispose()
  })

  it("should update dependents when dependencies change", () => {
    let value: number | undefined
    const mySignal = signal<number>(10)
    const myComputed = computed(() => mySignal.get() * 2)
    myComputed.subscribe((newValue) => {
      value = newValue
    })

    mySignal.set(5)
    expect(value).toBe(10)

    mySignal.dispose()
  })

  it("should dispose the computed", () => {
    let value: number | undefined
    const mySignal = signal<number>(10)
    const myComputed = computed(() => mySignal.get() * 2)
    const fx = myComputed.subscribe((newValue) => {
      value = newValue
    })

    mySignal.set(5)
    expect(value).toBe(10)

    fx.dispose()
    mySignal.set(20)
    expect(value).toBe(10)

    mySignal.dispose()
  })
})

describe("Effect", () => {
  it("should initially execute the effect function", () => {
    let executed = false
    const fx = effect(() => {
      executed = true
    })

    expect(executed).toBeTrue()

    fx.dispose()
  })

  it("should execute the effect function only once per change", () => {
    let count = 0
    const mySignal = signal<number>(10)

    effect(() => {
      count++
      mySignal.get()
    })

    mySignal.set(20)
    expect(count).toBe(2)
    mySignal.set(30)
    expect(count).toBe(3)

    mySignal.dispose()
  })

  it("should dispose the effect", () => {
    let executed = 0
    let mySignal = signal<number>(10)

    const fx = effect(() => {
      executed += 1
      mySignal.get()
    })

    fx.dispose()
    expect(executed).toBe(1)
    mySignal.set(20)
    expect(executed).toBe(1)

    mySignal.dispose()
  })
})

describe("Batching", () => {
  it("should batch updates", () => {
    let count = 0
    const mySignal = signal<number>(10)
    const myComputed = computed(() => mySignal.get() * 2)
    effect(() => {
      count++
      myComputed.get()
    })

    mySignal.set(5)
    mySignal.set(5) // Should not notify for the same value
    expect(count).toBe(2)

    mySignal.set(5, true) // Should not notify for the same value, unless forced
    expect(count).toBe(3)

    mySignal.set(10)
    expect(count).toBe(4)

    batch(() => {
      mySignal.set(15)
      mySignal.set(20)
      mySignal.set(50)
    })
    expect(count).toBe(5)
    expect(myComputed.get()).toBe(100)

    mySignal.dispose() // Should dispose the computed and effect
    // console.log("_registry keys:", Array.from(_registry.keys()))
    expect(_registry.size).toBe(0)
  })
})

// describe("Signal - Performance", () => {
//   it("should handle 100k signals", () => {
//     const signals: any[] = []
//     for (let i = 0; i < 100_000; i++) {
//       signals.push(signal(i))
//     }

//     for (let i = 0; i < 100_000; i++) {
//       signals[i].set(i + 1)
//     }

//     for (let i = 0; i < 100_000; i++) {
//       expect(signals[i]()).toBe(i + 1)
//     }
//   })
// })
