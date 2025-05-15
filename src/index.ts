// ── Core Types ───────────────────────────────────────────

export type Ok<ValueType> = {
	readonly ok: true
	readonly value: ValueType
	readonly error?: undefined
}

export type Err<ErrorType = unknown> = {
	readonly ok: false
	readonly error: ErrorType
	readonly value?: undefined
}

/**
 * Union type representing either a successful (Ok) or failed (Err) computation result.
 *
 * @typeparam ValueType - The type of the value in a successful result
 * @typeparam ErrorType - The type of the error in a failed result
 */
export type Result<ValueType, ErrorType = unknown> =
	| Ok<ValueType>
	| Err<ErrorType>

// ── Constructors ─────────────────────────────────────────

/**
 * Construct a successful Result containing a value.
 *
 * @example
 * const success = ok(42)
 * console.log(success.value) // 42
 */
export function ok<T>(value: T): Ok<T>
/**
 * Construct a successful Result with undefined value.
 *
 * @example
 * const success = ok()
 * console.log(success.value) // undefined
 */
export function ok(): Ok<undefined>
export function ok<T>(value?: T): Ok<T> {
	return { ok: true, value: value as T }
}

/**
 * Construct an error Result with a discriminant type and optional payload.
 *
 * @example
 * err('Timeout', { ms: 1000 }) // { ok: false, error: { type: 'Timeout', ms: 1000 }}
 */
export function err<
	K extends string,
	P extends Record<string, unknown> = Record<string, unknown>,
>(type: K, payload: P): Err<{ type: K } & P>
export function err<E extends string>(payload: E): Err<E>

/**
 * Construct an error Result from a single error object.
 *
 * @example
 * err({ type: 'Timeout', ms: 1000 }) // { ok: false, error: { type: 'Timeout', ms: 1000 }}
 * err({ message: 'fail' }) // { ok: false, error: { message: 'fail' }}
 */
export function err<E>(payload: E): Err<E>

/**
 * Implementation for err overloads. See overload docs for usage.
 */
export function err(typeOrPayload: any, payload?: any): Err<any> {
	if (payload) {
		return { ok: false, error: { type: typeOrPayload, ...payload } }
	} else {
		return { ok: false, error: typeOrPayload }
	}
}

// ── Utility Functions (functional style) ────────────────

export const map = <ValueType, NewValue, ErrorType = unknown>(
	r: Result<ValueType, ErrorType>,
	fn: (v: ValueType) => NewValue,
): Result<NewValue, ErrorType> => (r.ok ? ok(fn(r.value)) : r)

export const mapErr = <ValueType, ErrorType, NewError>(
	r: Result<ValueType, ErrorType>,
	fn: (e: ErrorType) => NewError,
): Result<ValueType, NewError> => (r.ok ? r : errAny(fn(r.error)))

export const flatMap = <ValueType, NewValue, ErrorType = unknown>(
	r: Result<ValueType, ErrorType>,
	fn: (v: ValueType) => Result<NewValue, ErrorType>,
): Result<NewValue, ErrorType> => (r.ok ? fn(r.value) : r)

export const unwrap = <ValueType, ErrorType = unknown>(
	r: Result<ValueType, ErrorType>,
): ValueType => {
	if (r.ok) return r.value
	throw r.error
}

export const orElse = <ValueType, ErrorType = unknown>(
	r: Result<ValueType, ErrorType>,
	fallback: ValueType,
): ValueType => (r.ok ? r.value : fallback)

export const annotate = <
	ErrorType,
	K extends string,
	P extends Record<string, unknown> = Record<string, unknown>,
>(
	r: Err<ErrorType>,
	type: K,
	payload: P = {} as P,
): Err<{ type: K } & P & { cause: ErrorType }> => ({
	ok: false,
	error: {
		type,
		...payload,
		cause: r.error,
	} as { type: K } & P & { cause: ErrorType },
})

// ── Universal factory / wrapper / rehydrator ────────────

const isPromiseLike = <T>(v: unknown): v is PromiseLike<T> =>
	typeof v === "object" && v !== null && "then" in v

export function result<ValueType>(work: () => ValueType): Result<ValueType>
export function result<ValueType>(
	work: PromiseLike<ValueType>,
): Promise<Result<ValueType>>
export function result<ValueType, ErrorType>(
	work: (() => ValueType) | PromiseLike<ValueType>,
): Result<ValueType, ErrorType> | Promise<Result<ValueType, ErrorType>> {
	if (isPromiseLike<ValueType>(work)) {
		return Promise.resolve(work)
			.then(ok<ValueType>)
			.catch((e: unknown) => errAny<ErrorType>(e as ErrorType))
	}

	try {
		return ok((work as () => ValueType)())
	} catch (e) {
		return errAny<ErrorType>(e as ErrorType)
	}
}

// ── Universal matchType ─────────────────────────────────

/**
 * Pattern match on a Result object (Ok/Err) or a discriminant string.
 *
 * Overloads:
 * - match(result, { ok, err })
 * - match(type, { A: fn, B: fn })
 */
export function match<ValueType, ErrorType, OnOk, OnErr>(
	r: Result<ValueType, ErrorType>,
	arms: { ok: (v: ValueType) => OnOk; err: (e: ErrorType) => OnErr },
): OnOk | OnErr
export function match<
	T extends string & (string extends T ? never : unknown),
	Cases extends { [K in T]: () => unknown },
>(
	value: T,
	cases: Cases & Record<Exclude<keyof Cases, T>, never>,
): ReturnType<Cases[keyof Cases]>
export function match(a: any, b: any): any {
	if (typeof a === "object" && a && "ok" in a) {
		return a.ok ? b.ok(a.value) : b.err(a.error)
	}
	return b[a]()
}
