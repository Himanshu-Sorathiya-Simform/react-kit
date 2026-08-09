import { useCallback, useRef, useState } from "react";
import type { UseThrottledStateOptions } from "./types.ts";
import { useThrottledCallback } from "./useThrottledCallback.ts";
import { isUpdaterFunction } from "./utils.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The tuple returned by `useThrottledState`, mirroring `useState`'s
 * `[value, setValue]` shape with a third element carrying throttle
 * controls.
 */
type UseThrottledStateReturn<T> = [
	/** The current (throttled) state value. */
	T,
	/**
	 * Schedules a throttled update to state. Accepts either a plain value
	 * or a `useState`-style functional updater (`(previous) => next`).
	 *
	 * The functional-updater form composes correctly across multiple rapid
	 * calls made before the cooldown window settles — e.g. calling
	 * `setValue((p) => p + 1)` three times in a row schedules a cumulative
	 * `+3`, not three competing `+1`s racing to be "the" pending value.
	 * `previous` in that case refers to the most recently *scheduled*
	 * value, not necessarily the currently-committed state — this matters
	 * if you're chaining updates faster than the window settles.
	 */
	(value: T | ((previous: T) => T)) => void,
	{
		/** See {@link UseThrottlerReturn.isPending}. */
		isPending: boolean;
		/**
		 * Cancels any pending throttled update. Also resyncs the internal
		 * "next value to commit" tracking back to the current committed
		 * state, so a subsequent functional update starts from the right
		 * baseline instead of building on a discarded value.
		 */
		cancel: () => void;
		/** See {@link UseThrottlerReturn.flush}. */
		flush: () => void;
		/**
		 * Bypasses throttle scheduling entirely and applies the value (or
		 * updater) immediately. Also cancels any throttled update that was
		 * still pending, so it can't land afterward and silently overwrite
		 * this forced value.
		 */
		forceSetValue: (value: T | ((previous: T) => T)) => void;
	},
];

/**
 * A `useState`-shaped hook whose setter rate-limits its effect on state
 * instead of applying immediately.
 *
 * @example
 * ```tsx
 * function ScoreBoard() {
 *   const [score, setScore, { flush, forceSetValue, isPending }] =
 *     useThrottledState(() => expensiveInitialScore(), 500);
 *
 *   return (
 *     <>
 *       <p>Score: {score}</p>
 *       <button onClick={() => setScore((s) => s + 1)}>+1 (throttled)</button>
 *       <button onClick={flush}>Flush pending update</button>
 *       <button onClick={() => forceSetValue(0)}>Reset instantly</button>
 *       {isPending && <span>update queued…</span>}
 *     </>
 *   );
 * }
 * ```
 *
 * @param initialValue - Initial state value, or a `useState`-style lazy
 * initializer function (`() => T`).
 * @param delay - See {@link useThrottler}.
 * @param options - See {@link UseThrottledStateOptions}.
 * @returns See {@link UseThrottledStateReturn}.
 */
function useThrottledState<T>(
	initialValue: T | (() => T),
	delay: number,
	options: UseThrottledStateOptions<T> = {},
): UseThrottledStateReturn<T> {
	if (
		isDev
		&& options.equalityFn !== undefined
		&& typeof options.equalityFn !== "function"
	) {
		console.warn(
			"[useThrottledState] `equalityFn` must be a function — falling back to `Object.is`.",
		);
	}

	const equalityFn =
		typeof options.equalityFn === "function" ? options.equalityFn : Object.is;

	const [state, setState] = useState<T>(initialValue);

	// Tracks the value that WILL be committed once the current throttle
	// window resolves — distinct from `state`, which only reflects what's
	// already committed. Lets functional updaters (`(p) => p + 1`) chain
	// correctly across several calls made before the window settles, since
	// each call's `previous` should see the *scheduled* value, not the
	// stale committed one.
	const pendingValueRef = useRef<T>(state);

	const commitValue = useCallback(
		(value: T) => {
			setState((previous) => (equalityFn(previous, value) ? previous : value));
		},
		[equalityFn],
	);

	const {
		throttledFunc: scheduleCommit,
		cancel: cancelThrottle,
		flush,
		isPending,
	} = useThrottledCallback(commitValue, delay, options);

	const setThrottledState = useCallback(
		(valueOrUpdater: T | ((previous: T) => T)) => {
			const nextValue =
				isUpdaterFunction(valueOrUpdater) ?
					valueOrUpdater(pendingValueRef.current)
				:	valueOrUpdater;

			pendingValueRef.current = nextValue;

			scheduleCommit(nextValue);
		},
		[scheduleCommit],
	);

	const cancel = useCallback(() => {
		cancelThrottle();

		// Resync the "next value" tracker back to whatever is actually
		// committed, now that the pending update has been discarded —
		// otherwise a subsequent functional update would build on a value
		// that was just thrown away.
		setState((current) => {
			pendingValueRef.current = current;

			return current;
		});
	}, [cancelThrottle]);

	const forceSetValue = useCallback(
		(valueOrUpdater: T | ((previous: T) => T)) => {
			cancelThrottle();

			setState((previous) => {
				const nextValue =
					isUpdaterFunction(valueOrUpdater) ?
						valueOrUpdater(previous)
					:	valueOrUpdater;

				pendingValueRef.current = nextValue;

				return nextValue;
			});
		},
		[cancelThrottle],
	);

	return [
		state,
		setThrottledState,
		{ isPending, cancel, flush, forceSetValue },
	] as const;
}

export { type UseThrottledStateReturn, useThrottledState };
