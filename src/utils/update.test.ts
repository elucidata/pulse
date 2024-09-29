import { describe, expect, it } from "bun:test"
import { signal } from "../internals"
import { update } from "./update"

describe("Update Util", () => {
    it("should properly merge signal<object>", () => {
        const a = signal({ one: 1, two: 0 })
        let ret = void 0 as void | any[]

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
        expect(ret).toBeUndefined()

        ret = update(a, { two: 3 }, true)
        //@ts-ignore
        expect(a.get()).toEqual({ one: 1, two: 3, three: true })
        expect(ret).toHaveLength(0)
    })

    it("should properly update signal<scalar>", () => {
        const a = signal(10)
        let ret = void 0 as void | any[]

        expect(a.get()).toBe(10)

        ret = update(a, (v) => v + 5)
        expect(a.get()).toBe(15)
        expect(ret).toBeUndefined()

        ret = update(a, (v) => v * 2)
        expect(a.get()).toBe(30)
        expect(ret).toBeUndefined()

        ret = update(a, (v) => v)
        expect(a.get()).toBe(30)
        expect(ret).toBeUndefined()
    })
})
