import { describe, expect, it } from "bun:test"
import { signal } from "./index"
import { persistedSignal, update } from "./with-utils"

describe("Update Util", () => {
  it("should properly merge signal<object>", () => {
    const a = signal({ one: 1, two: 0 })
    let ret = false as boolean | any[]

    expect(a.get()).toEqual({ one: 1, two: 0 })

    ret = update(a, { two: 3 }, true)
    expect(a.get()).toEqual({ one: 1, two: 3 })
    expect(ret).toBeArray()
    expect(ret).toHaveLength(1)

    // Types will fail, but it should work
    //@ts-ignore
    ret = update(a, { three: true })
    //@ts-ignore
    expect(a.get()).toEqual({ one: 1, two: 3, three: true })
    expect(ret).toBeTrue()

    ret = update(a, { two: 3 }, true)
    //@ts-ignore
    expect(a.get()).toEqual({ one: 1, two: 3, three: true })
    expect(ret).toHaveLength(0)
  })

  it("should properly update signal<scalar>", () => {
    const a = signal(10)
    let ret = false as boolean | any[]

    expect(a.get()).toBe(10)

    ret = update(a, (v) => v + 5)
    expect(a.get()).toBe(15)
    expect(ret).toBeTrue()

    ret = update(a, (v) => v * 2)
    expect(a.get()).toBe(30)
    expect(ret).toBeTrue()

    ret = update(a, (v) => v)
    expect(a.get()).toBe(30)
    expect(ret).toBeFalse()
  })
})

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
    expect(psig.get()).toBe(10)

    psig.set(20)
    expect(psig.get()).toBe(20)
    expect(getItemCalled).toBe(1)
    expect(setItemCalled).toBe(2)

    psig.dispose()
    psig.set(50) // Should not persist or update
    expect(getItemCalled).toBe(1)
    expect(setItemCalled).toBe(2)
  })
})

// describe.skip("List Signal", () => {
//   it("should add and remove items", () => {
//     const toValue = (sig: any) => sig()
//     const listSig = list<number>([1, 2, 3])

//     expect(listSig.map(toValue)).toEqual([1, 2, 3])

//     listSig.add(4)
//     expect(listSig.map(toValue)).toEqual([1, 2, 3, 4])

//     listSig.remove(listSig.at(1))
//     expect(listSig.map(toValue)).toEqual([1, 3, 4])

//     listSig.add(5)
//     expect(listSig.map(toValue)).toEqual([1, 3, 4, 5])
//   })

//   it("should add and remove items by index", () => {
//     const toValue = (sig: any) => sig()
//     const listSig = list<number>([1, 2, 3])

//     expect(listSig.map(toValue)).toEqual([1, 2, 3])

//     listSig.add(4, 1)
//     expect(listSig.map(toValue)).toEqual([1, 4, 2, 3])

//     listSig.remove(listSig.at(2))
//     expect(listSig.map(toValue)).toEqual([1, 4, 3])

//     listSig.add(5, 2)
//     expect(listSig.map(toValue)).toEqual([1, 4, 5, 3])
//   })

//   it("should clear the list", () => {
//     const toValue = (sig: any) => sig()
//     const listSig = list<number>([1, 2, 3])

//     expect(listSig.map(toValue)).toEqual([1, 2, 3])

//     listSig.clear()
//     expect(listSig.map(toValue)).toEqual([])
//   })

//   it("should filter the list", () => {
//     const toValue = (sig: any) => sig()
//     const listSig = list<number>([1, 2, 3])

//     expect(listSig.map(toValue)).toEqual([1, 2, 3])

//     const filtered = listSig.filter((sig) => sig.get() % 2 === 0)
//     expect(filtered.map(toValue)).toEqual([2])
//   })

//   it("should iterate the list", () => {
//     const toValue = (sig: any) => sig()
//     const listSig = list<number>([1, 2, 3])

//     expect(listSig.map(toValue)).toEqual([1, 2, 3])

//     let sum = 0
//     listSig.forEach((sig) => {
//       sum += sig.get()
//     })
//     expect(sum).toBe(6)
//   })

//   it("should get the size of the list", () => {
//     const listSig = list<number>([1, 2, 3])

//     expect(listSig.size()).toBe(3)
//   })

//   it("should get the index of an item", () => {
//     const listSig = list<number>([1, 2, 3])

//     expect(listSig.indexOf(listSig.at(1))).toBe(1)
//   })

//   it("should get the item at an index", () => {
//     const toValue = (sig: any) => sig()
//     const listSig = list<number>([1, 2, 3])

//     expect(listSig.at(1).get()).toBe(2)
//   })

//   // Not sure this is true...
//   // it("should not add the same signal twice", () => {
//   //   const listSig = list<number>([1, 2, 3])

//   //   const sig = signal(4)
//   //   listSig.add(sig)
//   //   listSig.add(sig)
//   //   expect(listSig.size()).toBe(4)
//   // })
// })
