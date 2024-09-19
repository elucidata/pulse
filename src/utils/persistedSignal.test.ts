import { describe, expect, it } from "bun:test"
import { persistedSignal } from "./persistedSignal"

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
})
