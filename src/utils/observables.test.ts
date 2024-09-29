import { describe, expect, it } from "bun:test"
import { map, observable, filter } from "./observables"

describe("Observables", () => {
    describe("observable", () => {
        // ... existing tests ...

        it("should call the subscriber with emitted values", () => {
            const setup = (emit: (value: number) => void) => {
                emit(1)
                emit(2)
                return () => {}
            }

            const obs = observable(setup)
            const values: number[] = []
            const unsubscribe = obs.subscribe((value) => {
                values.push(value)
            })

            expect(values).toEqual([2]) // Only the last value should be emitted
            unsubscribe()
        })

        it("should handle multiple subscribers", () => {
            const setup = (emit: (value: number) => void) => {
                emit(1)
                return () => {}
            }

            const obs = observable(setup)
            const values1: number[] = []
            const values2: number[] = []

            const unsubscribe1 = obs.subscribe((value) => {
                values1.push(value)
            })

            const unsubscribe2 = obs.subscribe((value) => {
                values2.push(value)
            })

            expect(values1).toEqual([1])
            expect(values2).toEqual([1])

            unsubscribe1()
            unsubscribe2()
        })

        it("should call teardown when the last subscriber unsubscribes", () => {
            let teardownCalled = false
            const setup = (emit: (value: number) => void) => {
                emit(1)
                return () => {
                    teardownCalled = true
                }
            }

            const obs = observable(setup)
            const unsubscribe1 = obs.subscribe(() => {})
            const unsubscribe2 = obs.subscribe(() => {})

            unsubscribe1()
            expect(teardownCalled).toBe(false)

            unsubscribe2()
            expect(teardownCalled).toBe(true)
        })

        it("should not emit values after teardown", () => {
            const setup = (emit: (value: number) => void) => {
                emit(1)
                return () => {}
            }

            const obs = observable(setup)
            const values: number[] = []

            const unsubscribe = obs.subscribe((value) => {
                values.push(value)
            })

            unsubscribe()
            expect(values).toEqual([1])

            const unsubscribe2 = obs.subscribe((value) => {
                values.push(value)
            })

            expect(values).toEqual([1, 1])
            unsubscribe2()
        })

        it("should allow mapping and filtering", () => {
            const setup = (emit: (value: number) => void) => {
                emit(1)
                emit(2)
                return () => {}
            }

            const obs = observable(setup)
            const mapped = obs.map((value) => value * 2)
            const filtered = mapped.filter((value) => value % 2 === 0)
            const values: number[] = []

            const unsubscribe = filtered.subscribe((value) => {
                values.push(value)
            })

            expect(values).toEqual([4])
            unsubscribe()
        })
    })

    describe("map", () => {
        it("should map values from the source observable", () => {
            const setup = (emit: (value: number) => void) => {
                emit(1)
                emit(2)
                return () => {}
            }

            const source = observable(setup)
            const mapped = map(source, (value) => value * 2)
            const values: number[] = []

            const unsubscribe = mapped.subscribe((value) => {
                values.push(value)
            })

            expect(values).toEqual([4])
            unsubscribe()
        })

        it("should handle multiple subscribers", () => {
            const setup = (emit: (value: number) => void) => {
                emit(1)
                return () => {}
            }

            const source = observable(setup)
            const mapped = map(source, (value) => value * 2)
            const values1: number[] = []
            const values2: number[] = []

            const unsubscribe1 = mapped.subscribe((value) => {
                values1.push(value)
            })

            const unsubscribe2 = mapped.subscribe((value) => {
                values2.push(value)
            })

            expect(values1).toEqual([2])
            expect(values2).toEqual([2])

            unsubscribe1()
            unsubscribe2()
        })

        it("should call teardown when the last subscriber unsubscribes", () => {
            let teardownCalled = false
            const setup = (emit: (value: number) => void) => {
                emit(1)
                return () => {
                    teardownCalled = true
                }
            }

            const source = observable(setup)
            const mapped = map(source, (value) => value * 2)
            const unsubscribe1 = mapped.subscribe(() => {})
            const unsubscribe2 = mapped.subscribe(() => {})

            unsubscribe1()
            expect(teardownCalled).toBe(false)

            unsubscribe2()
            expect(teardownCalled).toBe(true)
        })

        it("should not emit values after teardown", () => {
            const setup = (emit: (value: number) => void) => {
                emit(1)
                return () => {}
            }

            const source = observable(setup)
            const mapped = map(source, (value) => value * 2)
            const values: number[] = []

            const unsubscribe = mapped.subscribe((value) => {
                values.push(value)
            })

            unsubscribe()
            expect(values).toEqual([2])

            const unsubscribe2 = mapped.subscribe((value) => {
                values.push(value)
            })

            expect(values).toEqual([2, 2])
            unsubscribe2()
        })
    })

    describe("filter", () => {
        it("should filter values from the source observable", () => {
            const setup = (emit: (value: number) => void) => {
                emit(1)
                emit(2)
                return () => {}
            }

            const source = observable(setup) // this will only emit 2 (the last value)
            const filtered = filter(source, (value) => value % 2 === 0)
            const values: number[] = []

            const unsubscribe = filtered.subscribe((value) => {
                values.push(value)
            })

            expect(values).toEqual([2])
            unsubscribe()
        })

        it("should handle multiple subscribers", () => {
            const setup = (emit: (value: number) => void) => {
                emit(1)
                emit(2)
                return () => {}
            }

            const source = observable(setup)
            const filtered = filter(source, (value) => value % 2 === 0)
            const values1: number[] = []
            const values2: number[] = []

            const unsubscribe1 = filtered.subscribe((value) => {
                values1.push(value)
            })

            const unsubscribe2 = filtered.subscribe((value) => {
                values2.push(value)
            })

            expect(values1).toEqual([2])
            expect(values2).toEqual([2])

            unsubscribe1()
            unsubscribe2()
        })

        it("should call teardown when the last subscriber unsubscribes", () => {
            let teardownCalled = false
            const setup = (emit: (value: number) => void) => {
                emit(1)
                emit(2)
                return () => {
                    teardownCalled = true
                }
            }

            const source = observable(setup)
            const filtered = filter(source, (value) => value % 2 === 0)
            const unsubscribe1 = filtered.subscribe(() => {})
            const unsubscribe2 = filtered.subscribe(() => {})

            unsubscribe1()
            expect(teardownCalled).toBe(false)

            unsubscribe2()
            expect(teardownCalled).toBe(true)
        })

        it("should not emit values after teardown", () => {
            const setup = (emit: (value: number) => void) => {
                emit(1)
                emit(2)
                return () => {}
            }

            const source = observable(setup)
            const filtered = filter(source, (value) => value % 2 === 0)
            const values: number[] = []

            const unsubscribe = filtered.subscribe((value) => {
                values.push(value)
            })

            unsubscribe()
            expect(values).toEqual([2])

            const unsubscribe2 = filtered.subscribe((value) => {
                values.push(value)
            })

            expect(values).toEqual([2, 2])
            unsubscribe2()
        })
    })
})
