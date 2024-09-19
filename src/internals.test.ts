import { describe, expect, it } from "bun:test"
import { Signal, batch, computed, effect } from "./internals"

describe("Signals Module", () => {
  describe("Signal", () => {
    it("should notify dependents on value change", () => {
      const signal = new Signal(1)
      let computedValue = 0

      effect(() => {
        computedValue = signal.value * 2
      })

      expect(computedValue).toBe(2)

      signal.value = 5

      expect(computedValue).toBe(10)
    })
  })

  describe("Effect", () => {
    it("should re-run when dependent signals change", () => {
      const signal = new Signal(1)
      let observedValue = 0

      effect(() => {
        observedValue = signal.value
      })

      expect(observedValue).toBe(1)

      signal.value = 2

      expect(observedValue).toBe(2)
    })

    it("should not re-run when unrelated signals change", () => {
      const signalA = new Signal(1)
      const signalB = new Signal(2)
      let observedValue = 0

      effect(() => {
        observedValue = signalA.value
      })

      expect(observedValue).toBe(1)

      signalB.value = 3

      expect(observedValue).toBe(1) // Should remain unchanged
    })

    it("should run immediately", () => {
      const signal = new Signal(1)
      let observedValue = 0

      effect(() => {
        observedValue = signal.value
      })

      expect(observedValue).toBe(1)
    })

    it("should cleanup when dependencies change", () => {
      const signalA = new Signal(1)
      const signalB = new Signal(2)
      let observedValue = 0

      effect(() => {
        observedValue = signalA.value
      })

      expect(observedValue).toBe(1)

      signalA.value = 3

      expect(observedValue).toBe(3)

      signalB.value = 4

      expect(observedValue).toBe(3) // Should remain unchanged
    })

    it("should cleanup when disposed", () => {
      const signal = new Signal(1)
      let observedValue = 0

      const unsubscribe = effect(() => {
        observedValue = signal.value
      })

      expect(observedValue).toBe(1)

      unsubscribe()

      signal.value = 2

      expect(observedValue).toBe(1) // Should remain unchanged
    })
  })
  describe("Effect Nesting", () => {
    it("should handle nested effects correctly", () => {
      const signal = new Signal(1)
      let observedValue1 = 0
      let observedValue2 = 0

      effect(() => {
        observedValue1 = signal.value

        effect(() => {
          observedValue2 = signal.value
        })
      })

      expect(observedValue1).toBe(1)
      expect(observedValue2).toBe(1)

      signal.value = 2

      expect(observedValue1).toBe(2)
      expect(observedValue2).toBe(2)
    })

    it("should handle nested effect cleanups correctly", () => {
      const signal = new Signal(1)
      let observedValue1 = 0
      let observedValue2 = 0

      const unsubscribe1 = effect(() => {
        observedValue1 = signal.value

        const unsubscribe2 = effect(() => {
          observedValue2 = signal.value
        })

        return () => {
          unsubscribe2()
        }
      })

      expect(observedValue1).toBe(1)
      expect(observedValue2).toBe(1)

      signal.value = 2

      expect(observedValue1).toBe(2)
      expect(observedValue2).toBe(2)

      unsubscribe1()
    })

    it("should call nested cleanups in the correct order", () => {
      const signal = new Signal(1)
      let cleanupOrder = ""

      const unsubscribe1 = effect(() => {
        const unsubscribe2 = effect(() => {
          const unsubscribe3 = effect(() => {
            cleanupOrder += "3"
          })

          return () => {
            cleanupOrder += "2"
            unsubscribe3()
          }
        })

        return () => {
          cleanupOrder += "1"
          unsubscribe2()
        }
      })

      unsubscribe1()

      expect(cleanupOrder).toBe("321")
    })

    it("should call nested effect cleanups correctly", () => {
      let cleanupOrder = ""
      const disposeRoot = effect(() => {
        // Root effect
        effect(() => {
          // Child 1 effect
          effect(() => {
            // Child 2 effect
            return () => {
              cleanupOrder += "2"
            }
          })
          return () => {
            cleanupOrder += "1"
          }
        })
        return () => {
          cleanupOrder += "0"
        }
      })

      disposeRoot()
      expect(cleanupOrder).toBe("210")
    })

    it("should call returned dispose function when disposed", () => {
      const signal = new Signal(1)
      let observedValue = 0
      let cleanupCalled = false

      const unsubscribe = effect(() => {
        observedValue = signal.value

        return () => {
          cleanupCalled = true
        }
      })

      expect(observedValue).toBe(1)

      unsubscribe()

      expect(cleanupCalled).toBeTrue()
    })

    it("should call returned dispose function when dependencies change", () => {
      const signalA = new Signal(1)
      const signalB = new Signal(2)
      let observedValue = 0
      let cleanupCalled = false

      const unsubscribe = effect(() => {
        observedValue = signalA.value

        return () => {
          cleanupCalled = true
        }
      })

      expect(observedValue).toBe(1)

      signalA.value = 3

      expect(observedValue).toBe(3)
      expect(cleanupCalled).toBeTrue()
    })

    it("should support nested effect revaluation when dependencies change", () => {
      const signalA = new Signal(1)
      const signalB = new Signal(2)

      let observedValueA = 0
      let observedValueB = 0

      let rootCleanupCalled = 0
      let nestedCleanupCalled = 0

      const unsubscribe = effect(() => {
        observedValueA = signalA.value

        effect(() => {
          observedValueB = signalB.value

          return () => {
            nestedCleanupCalled++
          }
        })

        return () => {
          rootCleanupCalled++
        }
      })

      expect(observedValueA).toBe(1)
      expect(observedValueB).toBe(2)
      expect(rootCleanupCalled).toBe(0)
      expect(nestedCleanupCalled).toBe(0)

      signalB.value = 20

      expect(observedValueA).toBe(1)
      expect(observedValueB).toBe(20)
      expect(rootCleanupCalled).toBe(0)
      expect(nestedCleanupCalled).toBe(1)

      signalA.value = 10

      expect(observedValueA).toBe(10)
      expect(observedValueB).toBe(20)
      expect(rootCleanupCalled).toBe(1)
      expect(nestedCleanupCalled).toBe(2)

      unsubscribe()

      expect(rootCleanupCalled).toBe(2)
      expect(nestedCleanupCalled).toBe(3)
    })
  })

  describe("Computed", () => {
    it("should update when dependencies change", () => {
      const signal = new Signal(2)
      const computedSignal = computed(() => signal.value * 3)

      expect(computedSignal.value).toBe(6)

      signal.value = 5

      expect(computedSignal.value).toBe(15)
    })
  })

  describe("Dependency Tracking", () => {
    it("should track dependencies dynamically", () => {
      const signalA = new Signal(1)
      const signalB = new Signal(2)
      let observedValue = 0
      let useSignalA = true

      effect(() => {
        observedValue = useSignalA ? signalA.value : signalB.value
      })

      expect(observedValue).toBe(1)

      // useSignalA = false
      signalB.value = 3

      expect(observedValue).toBe(1)

      signalA.value = 5

      expect(observedValue).toBe(5) // Should remain unchanged since dependency has changed
    })
  })
})

describe("Batching in Signals Module", () => {
  it("should batch multiple signal updates and run computations once", () => {
    const signalA = new Signal(1)
    const signalB = new Signal(2)
    let computationRunCount = 0
    let computedValue = 0

    effect(() => {
      computationRunCount++
      computedValue = signalA.value + signalB.value
    })

    expect(computationRunCount).toBe(1)
    expect(computedValue).toBe(3)

    batch(() => {
      signalA.value = 10
      signalB.value = 20
      // Computation should not run yet
      expect(computationRunCount).toBe(1)
    })

    // After batch completes, computation should have run once
    expect(computationRunCount).toBe(2)
    expect(computedValue).toBe(30)
  })

  it("should handle nested batches correctly", () => {
    const signal = new Signal(1)
    let computationRunCount = 0
    let observedValue = 0

    effect(() => {
      computationRunCount++
      observedValue = signal.value
    })

    expect(computationRunCount).toBe(1)
    expect(observedValue).toBe(1)

    batch(() => {
      signal.value = 2

      batch(() => {
        signal.value = 3
      })

      signal.value = 4
      // Computation should not run yet
      expect(computationRunCount).toBe(1)
    })

    // Computation should have run only once after the outer batch
    expect(computationRunCount).toBe(2)
    expect(observedValue).toBe(4)
  })

  it("should run computations immediately when not batching", () => {
    const signal = new Signal(1)
    let computationRunCount = 0
    let observedValue = 0

    effect(() => {
      computationRunCount++
      observedValue = signal.value
    })

    expect(computationRunCount).toBe(1)
    expect(observedValue).toBe(1)

    signal.value = 2

    // Computation should have run immediately
    expect(computationRunCount).toBe(2)
    expect(observedValue).toBe(2)
  })

  it("should collect computations only once during batch", () => {
    const signalA = new Signal(1)
    const signalB = new Signal(2)
    let computationRunCount = 0

    effect(() => {
      computationRunCount++
      // Computation depends on both signals
      signalA.value
      signalB.value
    })

    expect(computationRunCount).toBe(1)

    batch(() => {
      signalA.value = 3
      signalB.value = 4
      signalA.value = 5
      signalB.value = 6
      // Computation should not run yet
      expect(computationRunCount).toBe(1)
    })

    // Computation should have run only once after the batch
    expect(computationRunCount).toBe(2)
  })
})

describe("Signal Subscribe Method", () => {
  it("should call subscriber immediately upon subscription", () => {
    const signal = new Signal(10)
    let subscriberValue = 0

    const unsubscribe = signal.subscribe((value) => {
      subscriberValue = value
    })

    expect(subscriberValue).toBe(10)

    unsubscribe()
  })

  it("should notify subscriber when signal value changes", () => {
    const signal = new Signal(10)
    let subscriberValue = 0

    const unsubscribe = signal.subscribe((value) => {
      subscriberValue = value
    })

    expect(subscriberValue).toBe(10)

    signal.value = 20
    expect(subscriberValue).toBe(20)

    signal.value = 30
    expect(subscriberValue).toBe(30)

    unsubscribe()
  })

  it("should stop notifying after unsubscribe is called", () => {
    const signal = new Signal(10)
    let subscriberValue = 0

    const unsubscribe = signal.subscribe((value) => {
      subscriberValue = value
    })

    expect(subscriberValue).toBe(10)

    unsubscribe()

    signal.value = 20
    expect(subscriberValue).toBe(10) // Should not have updated
  })

  it("should allow multiple subscribers", () => {
    const signal = new Signal(5)
    let subscriberValue1 = 0
    let subscriberValue2 = 0

    const unsubscribe1 = signal.subscribe((value) => {
      subscriberValue1 = value
    })

    const unsubscribe2 = signal.subscribe((value) => {
      subscriberValue2 = value
    })

    expect(subscriberValue1).toBe(5)
    expect(subscriberValue2).toBe(5)

    signal.value = 15
    expect(subscriberValue1).toBe(15)
    expect(subscriberValue2).toBe(15)

    unsubscribe1()

    signal.value = 25
    expect(subscriberValue1).toBe(15) // Should not have updated
    expect(subscriberValue2).toBe(25)

    unsubscribe2()
  })

  it("should work with computed signals", () => {
    const signal = new Signal(2)
    const computedSignal = computed(() => signal.value * 3)

    let subscriberValue = 0

    const unsubscribe = computedSignal.subscribe((value) => {
      subscriberValue = value
    })

    // Since computed signals compute immediately, ensure the initial value is set
    expect(subscriberValue).toBe(6)

    signal.value = 4
    expect(subscriberValue).toBe(12)

    unsubscribe()
  })

  it("should not notify subscribers when the same value is set", () => {
    const signal = new Signal(10)
    let notificationCount = 0

    const unsubscribe = signal.subscribe((value) => {
      notificationCount++
    })

    expect(notificationCount).toBe(1) // Initial call

    signal.value = 10 // Same value
    expect(notificationCount).toBe(1) // Should not have incremented

    signal.value = 20
    expect(notificationCount).toBe(2)

    unsubscribe()
  })

  it("should not throw error if unsubscribe is called multiple times", () => {
    const signal = new Signal(5)
    let subscriberValue = 0

    const unsubscribe = signal.subscribe((value) => {
      subscriberValue = value
    })

    expect(subscriberValue).toBe(5)

    unsubscribe()
    expect(() => unsubscribe()).not.toThrow()

    signal.value = 10
    expect(subscriberValue).toBe(5) // Should not have updated
  })
})
