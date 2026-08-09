import { useCallback, useState } from "react";
import type { UseRateLimitedStateOptions } from "./types.ts";
import { useRateLimitedCallback } from "./useRateLimitedCallback.ts";
import { isUpdaterFunction } from "./utils.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The tuple returned by `useRateLimitedState`, mirroring `useState`'s
 * `[value, setValue]` shape with a third element carrying rate-limit
 * controls.
 */
type UseRateLimitedStateReturn<T> = [
	/** The current, committed state value. */
	T,
	/**
	 * Attempts to update state. Accepts either a plain value or a
	 * `useState`-style functional updater (`(previous) => next`).
	 *
	 * Unlike the debounce/throttle `State` variants, nothing here is ever
	 * deferred — the update either applies immediately (against the
	 * genuinely current state, via React's own functional `setState`) or
	 * is rejected outright and state doesn't change at all. There's no
	 * "most recently scheduled value" to reason about, since nothing is
	 * ever queued.
	 *
	 * @returns `true` if the update was applied, `false` if it was
	 * rejected because the allowance is exhausted.
	 */
	(value: T | ((previous: T) => T)) => boolean,
	{
		/** See {@link UseRateLimiterReturn.remaining}. */
		remaining: number;
		/** See {@link UseRateLimiterReturn.isRateLimited}. */
		isRateLimited: boolean;
		/** See {@link UseRateLimiterReturn.reset}. */
		reset: () => void;
		/**
		 * Bypasses rate-limit enforcement entirely and applies the value
		 * (or updater) immediately. Does not consume any of the allowance.
		 */
		forceSetValue: (value: T | ((previous: T) => T)) => void;
	},
];

/**
 * A `useState`-shaped hook whose setter can be rejected once the
 * allowance for the current window is exhausted, instead of always
 * applying.
 *
 * @example
 * ```tsx
 * function GenerationDemo() {
 *   const [result, generate, { remaining, isRateLimited }] =
 *     useRateLimitedState<string | null>(null, 3, 60_000);
 *
 *   const handleGenerate = () => {
 *     if (!generate(`Result #${Math.random()}`)) {
 *       toast("Free limit reached — try again in a minute.");
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleGenerate} disabled={isRateLimited}>
 *         Generate ({remaining} left)
 *       </button>
 *       <p>{result}</p>
 *     </>
 *   );
 * }
 * ```
 *
 * @param initialValue - Initial state value, or a `useState`-style lazy
 * initializer function (`() => T`).
 * @param limit - See {@link useRateLimiter}.
 * @param windowMs - See {@link useRateLimiter}.
 * @param options - See {@link UseRateLimitedStateOptions}.
 * @returns See {@link UseRateLimitedStateReturn}.
 */
function useRateLimitedState<T>(
	initialValue: T | (() => T),
	limit: number,
	windowMs: number,
	options: UseRateLimitedStateOptions<T> = {},
): UseRateLimitedStateReturn<T> {
	if (
		isDev
		&& options.equalityFn !== undefined
		&& typeof options.equalityFn !== "function"
	) {
		console.warn(
			"[useRateLimitedState] `equalityFn` must be a function — falling back to `Object.is`.",
		);
	}

	const equalityFn =
		typeof options.equalityFn === "function" ? options.equalityFn : Object.is;

	const [state, setState] = useState<T>(initialValue);

	// Shared by both the rate-limited setter and `forceSetValue`, so both
	// paths resolve the updater form and apply the equality check
	// identically.
	const applyValue = useCallback(
		(valueOrUpdater: T | ((previous: T) => T)) => {
			setState((previous) => {
				const nextValue =
					isUpdaterFunction(valueOrUpdater) ?
						valueOrUpdater(previous)
					:	valueOrUpdater;

				return equalityFn(previous, nextValue) ? previous : nextValue;
			});
		},
		[equalityFn],
	);

	const { rateLimitedFunc, reset, remaining, isRateLimited } =
		useRateLimitedCallback(applyValue, limit, windowMs, options);

	const setRateLimitedState = useCallback(
		(valueOrUpdater: T | ((previous: T) => T)) =>
			rateLimitedFunc(valueOrUpdater),
		[rateLimitedFunc],
	);

	const forceSetValue = useCallback(
		(valueOrUpdater: T | ((previous: T) => T)) => {
			applyValue(valueOrUpdater);
		},
		[applyValue],
	);

	return [
		state,
		setRateLimitedState,
		{ remaining, isRateLimited, reset, forceSetValue },
	] as const;
}

export { type UseRateLimitedStateReturn, useRateLimitedState };
