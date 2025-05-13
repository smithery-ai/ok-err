import { type Result, err, errAny, ok, result } from "../src"

/* ------------------------------------------------------------------ */
/* Constructors                                                        */
/* ------------------------------------------------------------------ */
describe("constructors", () => {
	test.each([
		["ok", ok(1), true],
		["err", err("X")(), false],
		["errUnknown", errAny(new Error()), false],
	])("%s()", (_, r, expected) => {
		expect(r.ok).toBe(expected)
	})

	test("ok undefined()", () => {
		expect(ok().ok).toBe(true)
		expect(ok().value).toBe(undefined)
	})
})

/* ------------------------------------------------------------------ */
/* Method chaining                                                     */
/* ------------------------------------------------------------------ */
describe("Ok / Err methods", () => {
	const double = (n: number) => n * 2

	test("map / mapErr", () => {
		const a = ok(2).map(double)
		const b = err("E")().map(double)
		const c = err("E")({ id: 1 }).mapErr((e) => ({ ...e, tag: "X" }))

		expect(a.ok && a.value).toBe(4)
		expect(!b.ok && b.error.type).toBe("E")
		expect(!c.ok && c.error.tag).toBe("X")
	})

	test("flatMap", () => {
		const div = (a: number, b: number): Result<number> =>
			b === 0 ? err("Div0")() : ok(a / b)

		expect(ok(10).flatMap((n) => div(n, 5)).ok).toBe(true)
		expect(ok(10).flatMap((n) => div(n, 0)).ok).toBe(false)
	})

	test("unwrap / or", () => {
		expect(ok(42).unwrap()).toBe(42)
		expect(ok(42).or(7)).toBe(42)
		expect(err("E")().or(7)).toBe(7)
	})

	test("iterable", () => {
		expect([...ok(3)]).toEqual([3])
		expect([...err("E")()]).toEqual([])
	})
})

/* ------------------------------------------------------------------ */
/* result() wrapper                                                    */
/* ------------------------------------------------------------------ */
describe("result()", () => {
	test("sync & throw", () => {
		const good = result(() => 1)
		const bad = result((): never => {
			throw new Error("boom")
		})

		expect(good.ok).toBe(true)
		expect(!bad.ok && bad.error).toBeInstanceOf(Error)
	})

	test("promise", async () => {
		const good = await result(Promise.resolve(1))
		const bad = await result(Promise.reject(new Error()))

		expect(good.ok).toBe(true)
		expect(!bad.ok).toBe(true)
	})

	test("rehydrate", () => {
		const rawJson = JSON.parse(JSON.stringify(ok(9))) as Result<number, unknown>
		const live = result(rawJson)
		expect(live.ok && live.value).toBe(9)
	})
})

/* ------------------------------------------------------------------ */
/* annotate() instance method                                          */
/* ------------------------------------------------------------------ */
describe("annotate() instance", () => {
	test("wraps Err with context", () => {
		const base = err("A")({ id: 2 })
		const ctx = base.annotate("B", { extra: 1 })

		expect(!ctx.ok && ctx.error.type).toBe("B")
		expect(ctx.error.cause.id).toBe(2)
		expect(ctx.error.cause.type).toBe("A")
	})
})

/* ------------------------------------------------------------------ */
/* Optional chaining helpers                                          */
/* ------------------------------------------------------------------ */
describe("optional chaining", () => {
	test("value? on Ok vs Err", () => {
		const okRes = ok({ n: 1 })
		const errRes = err("E")()

		expect(okRes.value?.n).toBe(1) // ok branch exposes value
		// @ts-expect-error value is undefined on Err at runtime
		expect(errRes.value?.n).toBeUndefined()
	})

	test("error? on Err vs Ok", () => {
		const okRes = ok(5) as Result<number, { type: string }>
		const errRes = err("Timeout")({ ms: 500 })
		expect(okRes.error?.type).toBeUndefined()
		expect(errRes.error?.type).toBe("Timeout")
	})
})

/* ------------------------------------------------------------------ */
/* match() instance method                                             */
/* ------------------------------------------------------------------ */
describe("match() instance", () => {
	test("branches correctly on Ok", () => {
		const res = ok(5)
		const doubled = res.match({
			ok: (v) => v * 2,
			err: () => 0,
		})
		expect(doubled).toBe(10)
	})

	test("branches correctly on Err", () => {
		const timeout = err("Timeout")({ ms: 1000 })
		const txt = timeout.match({
			ok: (v) => `value ${v}`,
			err: (e) => e.type,
		})
		expect(txt).toBe("Timeout")
	})

	test("exhaustively matches error variants", () => {
		const timeout = err("Timeout")({ ms: 2500 })

		const ms = timeout.matchType({
			Timeout: (e) => e.ms,
		})

		expect(ms).toBe(2500)
	})
})
