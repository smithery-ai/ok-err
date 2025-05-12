/* ── Core classes ─────────────────────────────────────────── */

/**
 * Represents a successful computation result.
 * Contains a value and methods for working with it in a chain.
 *
 * @typeparam ValueType - The type of the contained value
 */
export class Ok<ValueType> implements Iterable<ValueType> {
	/** Discriminant property, always true for Ok results. */
	readonly ok = true as const

	/**
	 * Creates a new Ok result containing the provided value.
	 *
	 * @param value - The successful result value
	 */
	constructor(public readonly value: ValueType) {}

	get raw() {
		return { ok: true, value: this.value }
	}

	/**
	 * Transform the contained value using the provided function.
	 * Similar to Array.map(), this lets you transform the value while staying in the Result context.
	 *
	 * @example
	 * ok(5).map(n => n * 2) // Ok with value 10
	 *
	 * @param fn - Function to transform the value
	 * @returns A new Ok containing the transformed value
	 */
	map<NewValue>(fn: (v: ValueType) => NewValue): Ok<NewValue> {
		return new Ok(fn(this.value))
	}

	/**
	 * Transform the error in an error result. For Ok instances this is a no-op.
	 * Provided for API compatibility with Err.mapErr().
	 *
	 * @param _fn - Function to transform the error (ignored for Ok)
	 * @returns This same Ok instance
	 */
	mapErr<NewError>(_fn: (e: never) => NewError): Ok<ValueType> {
		return this
	}

	/**
	 * Chain another Result-returning operation after this one.
	 * This is useful for sequences of operations that might fail.
	 *
	 * @example
	 * ok(10).flatMap(n => n > 0 ? ok(n) : err('Negative')()) // Ok with value 10
	 *
	 * @param fn - Function that takes the value and returns a new Result
	 * @returns The Result returned by the function
	 */
	flatMap<NewValue, ErrorType>(
		fn: (v: ValueType) => Result<NewValue, ErrorType>,
	): Result<NewValue, ErrorType> {
		return fn(this.value)
	}

	/**
	 * Extract the value from this Ok result.
	 * Safe to use when you know the Result is Ok.
	 *
	 * @example
	 * ok(42).unwrap() // 42
	 *
	 * @returns The contained value
	 */
	unwrap(): ValueType {
		return this.value
	}

	/**
	 * Extract the value or use a fallback if this is an Err.
	 * For Ok instances, this simply returns the contained value.
	 *
	 * @example
	 * ok(42).or(0) // 42
	 *
	 * @param _fallback - Value to use if this is an Err (unused for Ok)
	 * @returns The contained value
	 */
	or(_fallback: ValueType): ValueType {
		return this.value
	}

	/**
	 * Iteration: `for…of` yields the contained value once.
	 */
	*[Symbol.iterator](): Iterator<ValueType> {
		yield this.value
	}
}

/**
 * Represents a failed computation result.
 * Contains an error value and methods for working with it in a chain.
 *
 * @typeparam ErrorType - The type of the error value
 */
export class Err<ErrorType = unknown> implements Iterable<never> {
	/** Discriminant property, always false for Err results. */
	readonly ok = false as const

	/**
	 * Creates a new Err result containing the provided error.
	 *
	 * @param error - The error value
	 */
	constructor(public readonly error: ErrorType) {}

	get raw() {
		return { ok: false, error: this.error }
	}

	/**
	 * Add context to this error, creating a new error with a cause chain.
	 * This is particularly useful for wrapping lower-level errors with higher-level context.
	 *
	 * @example
	 * // Create an error chain
	 * const ioError = err('IO')({ errno: 'ENOENT' });
	 * const configError = ioError.annotate('ConfigFileMissing', { path: '/etc/app.json' });
	 *
	 * @param type - The type for the new error
	 * @param payload - Additional context properties for the new error
	 * @returns A new Err with this error as its cause
	 */
	annotate<
		K extends string,
		P extends Record<string, unknown> = Record<string, unknown>,
	>(type: K, payload: P = {} as P) {
		return new Err({
			type,
			...payload,
			cause: this.error,
		})
	}

	/**
	 * Transform the value in a successful result. For Err instances this is a no-op.
	 * This allows for chainable operations that safely skip over errors.
	 *
	 * @param _fn - Function to transform the value (ignored for Err)
	 * @returns This same Err instance
	 */
	map<NewValue>(_fn: (v: never) => NewValue): Err<ErrorType> {
		return this
	}

	/**
	 * Transform the contained error using the provided function.
	 * This is useful for adapting or enriching error information.
	 *
	 * @example
	 * err('NotFound')({ id: 123 }).mapErr(e => ({ ...e, message: `Item ${e.id} not found` }))
	 *
	 * @param fn - Function to transform the error
	 * @returns A new Err containing the transformed error
	 */
	mapErr<NewError>(fn: (e: ErrorType) => NewError): Err<NewError> {
		return new Err(fn(this.error))
	}

	/**
	 * Chain another Result-returning operation after this one.
	 * For Err instances, this is a no-op that propagates the error.
	 *
	 * @param _fn - Function that would map the value (ignored for Err)
	 * @returns This same Err instance
	 */
	flatMap<NewValue>(
		_fn: (v: never) => Result<NewValue, ErrorType>,
	): Err<ErrorType> {
		return this
	}

	/**
	 * Try to extract a value from this Err result.
	 * Since this is an Err, this always throws the contained error.
	 *
	 * @example
	 * err('NotFound')().unwrap() // Throws the error
	 *
	 * @throws The contained error
	 */
	unwrap(): never {
		throw this.error
	}

	/**
	 * Extract the value or use a fallback if this is an Err.
	 * For Err instances, this returns the provided fallback.
	 *
	 * @example
	 * err('NotFound')().or(0) // 0
	 *
	 * @param fallback - Value to use instead of the error
	 * @returns The provided fallback value
	 */
	or<Fallback>(fallback: Fallback): Fallback {
		return fallback
	}

	/**
	 * Iteration: an error yields nothing, behaving like an empty collection.
	 */
	*[Symbol.iterator](): Iterator<never> {
		// empty
	}
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

/* ── Constructors ─────────────────────────────────────────── */

/**
 * Construct a successful Result containing a value.
 *
 * @example
 * const success = ok(42);
 * console.log(success.value); // 42
 *
 * @param value - The value to wrap in an Ok result
 * @returns An Ok result containing the value
 */
export const ok = <T>(value: T): Ok<T> => new Ok(value)

/**
 * Construct a typed error Result with a discriminated error type and optional payload.
 * Automatically captures a stack trace frame to help with debugging.
 *
 * @example
 * // Create a timeout error with additional context
 * const timeout = err('Timeout')({ ms: 2000 });
 *
 * // Create an error with just a type
 * const notFound = err('NotFound')();
 *
 * @param type - The string discriminant type for the error
 * @returns A function that takes an optional payload and returns an Err
 */
export const err =
	<K extends string>(type: K) =>
	<Payload extends Record<string, unknown> = Record<string, unknown>>(
		payload: Payload = {} as Payload,
	) =>
		new Err({
			type,
			...payload,
		})

/**
 * Wrap any error value in an Err result without adding trace information.
 * Useful for working with existing error types or values that aren't in the Result format.
 *
 * @example
 * try {
 *   // Some code that might throw
 * } catch (error) {
 *   return errAny(error);
 * }
 *
 * @param e - Any value to wrap as an error
 * @returns An Err result containing the error value
 */
export const errAny = <E = unknown>(e: E): Err<E> => new Err(e)

/* ── Universal factory / wrapper / rehydrator ─────────────── */

const isPromiseLike = <T>(v: unknown): v is PromiseLike<T> =>
	typeof v === "object" && v !== null && "then" in v

/**
 * Wraps a synchronous function that might throw, converting exceptions into Result types.
 *
 * @example
 * const parsed = result(() => JSON.parse(json));
 * if (parsed.ok) {
 *   console.log(parsed.value);
 * } else {
 *   console.error('Parse error:', parsed.error);
 * }
 *
 * @param work - A function that might throw an exception
 * @returns A Result containing either the function's return value or the caught error
 */
export function result<ValueType>(work: () => ValueType): Result<ValueType>

/**
 * Wraps a Promise, converting fulfilled/rejected states into Result types.
 *
 * @example
 * const response = await result(fetch(url));
 * if (!response.ok) {
 *   console.error('Network error:', response.error);
 *   return;
 * }
 *
 * const data = await result(response.value.json());
 *
 * @param work - A Promise or Promise-like object
 * @returns A Promise that resolves to a Result
 */
export function result<ValueType>(
	work: PromiseLike<ValueType>,
): Promise<Result<ValueType>>

/**
 * Re-hydrates a plain Result-like object with the proper prototype methods.
 *
 * @example
 * // After JSON.parse, the Result has lost its methods
 * const raw = JSON.parse(serializedResult);
 *
 * // Re-hydrate to get the methods back
 * const live = result(raw);
 * const value = live.unwrap();
 *
 * @param work - A plain object with Result shape ({ok: true, value} or {ok: false, error})
 * @returns A proper Result instance with all methods
 */
export function result<ValueType, ErrorType>(
	work: Result<ValueType, ErrorType>,
): Result<ValueType, ErrorType>
export function result<ValueType, ErrorType>(
	work:
		| (() => ValueType)
		| PromiseLike<ValueType>
		| Result<ValueType, ErrorType>,
): Result<ValueType, ErrorType> | Promise<Result<ValueType, ErrorType>> {
	// Rehydrate
	if (typeof work === "object" && work !== null && "ok" in work) {
		return work.ok ? new Ok(work.value) : new Err(work.error)
	}

	// Promise‑like
	if (isPromiseLike<ValueType>(work)) {
		return Promise.resolve(work)
			.then(ok)
			.catch((e: unknown) => errAny<ErrorType>(e as ErrorType))
	}

	// Sync fn
	try {
		return ok((work as () => ValueType)())
	} catch (e) {
		return errAny<ErrorType>(e as ErrorType)
	}
}
