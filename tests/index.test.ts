import {
	type Result,
	err,
	flatMap,
	map,
	mapErr,
	match,
	ok,
	orElse,
	result,
	unwrap,
	cause,
} from "../src"

/* ------------------------------------------------------------------ */
/* Constructors                                                        */
/* ------------------------------------------------------------------ */
describe("constructors", () => {
	test.each([
		["ok", ok(1), true],
		["err", err("X"), false],
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
		const a = map(ok(2), double)
		const b = map(err("E"), double)
		const c = mapErr(err("E", { id: 1 }), (e) => ({ ...e, tag: "X" }))

		expect(a.ok && a.value).toBe(4)
		expect(!b.ok && b.error).toBe("E")
		expect(!c.ok && c.error.tag).toBe("X")
	})

	test("flatMap", () => {
		const div = (a: number, b: number): Result<number> =>
			b === 0 ? err("Div0") : ok(a / b)

		expect(flatMap(ok(10), (n) => div(n, 5)).ok).toBe(true)
		expect(flatMap(ok(10), (n) => div(n, 0)).ok).toBe(false)
	})

	test("unwrap / or", () => {
		expect(unwrap(ok(42))).toBe(42)
		expect(orElse(ok(42), 7)).toBe(42)
		expect(orElse(err("E"), 7)).toBe(7)
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
})

/* ------------------------------------------------------------------ */
/* annotate() instance method                                          */
/* ------------------------------------------------------------------ */
describe("annotate() function", () => {
	test("wraps Err with context", () => {
		const base = err("A", { id: 2 })
		const ctx = err("B", cause(base))

		expect(!ctx.ok && ctx.error.type).toBe("B")
		const errCause = ctx.error.cause as { id: number; type: string }
		expect(errCause.id).toBe(2)
		expect(errCause.type).toBe("A")
	})
})

/* ------------------------------------------------------------------ */
/* Optional chaining helpers                                          */
/* ------------------------------------------------------------------ */
describe("optional chaining", () => {
	test("value? on Ok vs Err", () => {
		const okRes = ok({ n: 1 })
		const errRes = err("E")

		expect(okRes.value?.n).toBe(1) // ok branch exposes value
		expect((errRes as any).value?.n).toBeUndefined() // value is not present on Err
	})

	test("error? on Err vs Ok", () => {
		const okRes = ok(5) as Result<number, { type: string }>
		const errRes = err("Timeout", { ms: 500 })
		expect((okRes as any).error?.type).toBeUndefined()
		expect(errRes.error?.type).toBe("Timeout")
		expect(okRes.value ?? okRes.error).toBe(5)
	})
	test("error? on Err vs Ok", () => {
		const okRes = ok(5) as Result<number, { type: string }>
		const errRes = err("Timeout", { ms: 500 }) as Result<
			number,
			{ type: string }
		>
		expect((okRes as any).error?.type).toBeUndefined()
		expect(errRes.error?.type).toBe("Timeout")
		expect(errRes.value ?? errRes.error?.type).toBe("Timeout")
	})
})

/* ------------------------------------------------------------------ */
/* match() instance method                                             */
/* ------------------------------------------------------------------ */
describe("match() function", () => {
	test("branches correctly on Ok", () => {
		const res = ok(5)
		const doubled = match(res, {
			ok: (v) => v * 2,
			err: () => 0,
		})
		expect(doubled).toBe(10)
	})

	test("branches correctly on Err", () => {
		const timeout = err("Timeout", { ms: 1000 })
		const txt = match(timeout, {
			ok: (v) => `value ${v}`,
			err: (e) => e.type,
		})
		expect(txt).toBe("Timeout")
	})
})

/* ------------------------------------------------------------------ */
/* matchType() instance method                                       */
/* ------------------------------------------------------------------ */
describe("matchType()", () => {
	test("works with implicit error types", () => {
		function multipleErrors() {
			// biome-ignore lint/correctness/noConstantCondition: <explanation>
			if (false) {
				return err("a")
			} else {
				return err("b")
			}
		}

		expect(
			match(multipleErrors().error, {
				a: () => "a",
				b: () => "b",
			}),
		).toBe("b")
	})

	test("exhaustively matches error variants", () => {
		const timeout = err("Timeout", { ms: 2500 })

		const ms = match(timeout.error.type, {
			Timeout: () => timeout.error.ms,
		})

		expect(ms).toBe(2500)
	})
})
