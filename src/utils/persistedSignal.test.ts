import { describe, expect, it } from "bun:test"
import { IStorage, persistedSignal } from "./persistedSignal"
import { computed, effect } from "../internals"

const fakeStorage = (log = false) => {
  let store: Record<string, any> = {}
  let getCount = 0
  let setCount = 0
  return {
    get counts() {
      return { getItem: getCount, setItem: setCount }
    },
    getItem: (key: string) => {
      getCount += 1
      const value = store[key] || null
      if (log) console.log("👀 Getting", key, value)
      return value
    },
    setItem: (key: string, value: any) => {
      if (log) console.log("💾 Setting", key, value)
      setCount += 1
      store[key] = value
    },
  }
}

describe("Persisted Signal", () => {
  it("should persist the value", () => {
    let getItemCalled = 0
    let setItemCalled = 0

    const psig = persistedSignal("test", 10, {
      storage: {
        getItem: (key: string) => {
          getItemCalled += 1
          expect(key).toBe("test")
          return "10"
        },
        setItem: (key: string, value: any) => {
          setItemCalled += 1
          expect(key).toBe("test")
          const isTenOrTwenty = value === "10" || value === "20"
          expect(isTenOrTwenty).toBeTrue()
        },
      },
    })
    expect(getItemCalled).toBe(2) // Initial value and effect
    expect(psig.get()).toBe(10)

    psig.set(20)
    expect(psig.get()).toBe(20)
    expect(getItemCalled).toBe(3) // Initial value, effect, and setItem
    expect(setItemCalled).toBe(2) // Initial value and setItem
  })

  it("should continue to act like a traditional signal", () => {
    const storage = fakeStorage()

    const psig = persistedSignal("test", 10, { storage })
    expect(storage.counts.getItem).toBe(2) // Initial value and effect
    expect(psig.get()).toBe(10)

    let effectCalled = 0
    const stop = effect(() => {
      effectCalled += 1
      psig.get()
    })
    const doubled = computed(() => psig.get() * 2)
    expect(effectCalled).toBe(1)
    psig.set(20)
    expect(effectCalled).toBe(2)
    expect(psig.get()).toBe(20)
    expect(storage.counts.getItem).toBe(3) // Initial value, effect, and setItem
    expect(storage.counts.setItem).toBe(2) // Initial value and setItem

    psig.set(25)
    expect(effectCalled).toBe(3)
    stop()
    psig.set(30)
    expect(effectCalled).toBe(3)
    expect(psig.get()).toBe(30)
    expect(doubled.get()).toBe(60)
  })
})
