import { useCallback, useRef, useState } from "react";
import type { UseDebouncedStateOptions } from "./types.ts";
import { useDebouncedCallback } from "./useDebouncedCallback.ts";
import { isUpdaterFunction } from "./utils.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The tuple returned by `useDebouncedState`, mirroring `useState`'s
 * `[value, setValue]` shape with a third element carrying debounce
 * controls.
 */
type UseDebouncedStateReturn<T> = [
	/** The current, committed state value. */
	T,
	/**
	 * Schedules a debounced update to state. Accepts either a plain value
	 * or a `useState`-style functional updater (`(previous) => next`).
	 *
	 * The functional-updater form composes correctly across multiple rapid
	 * calls made before the debounce settles — e.g. calling
	 * `setValue((p) => p + 1)` three times in a row schedules a cumulative
	 * `+3`, not three competing `+1`s racing to be "the" pending value.
	 * `previous` in that case refers to the most recently *scheduled*
	 * value, not necessarily the currently-committed state — this matters
	 * if you're chaining updates faster than the debounce settles.
	 */
	(value: T | ((previous: T) => T)) => void,
	{
		/** See {@link UseDebouncerReturn.isPending}. */
		isPending: boolean;
		/**
		 * Cancels any pending debounced update. Also resyncs the internal
		 * "next value to commit" tracking back to the current committed
		 * state, so a subsequent functional update starts from the right
		 * baseline instead of building on a discarded value.
		 */
		cancel: () => void;
		/** See {@link UseDebouncerReturn.flush}. */
		flush: () => void;
		/**
		 * Bypasses debounce scheduling entirely and applies the value (or
		 * updater) immediately. Also cancels any debounced update that was
		 * still pending, so it can't land afterward and silently overwrite
		 * this forced value.
		 */
		forceSetValue: (value: T | ((previous: T) => T)) => void;
	},
];

/**
 * A `useState`-shaped hook whose setter defers its effect on state until
 * the debounce window settles, instead of applying immediately.
 *
 * @example
 * ```tsx
 * function NoteEditor() {
 *   const [note, setNote, { isPending, flush, forceSetValue }] =
 *     useDebouncedState("", 800);
 *
 *   return (
 *     <>
 *       <textarea onChange={(e) => setNote(e.target.value)} />
 *       <p>Committed: {note}</p>
 *       {isPending && <span>Unsaved changes…</span>}
 *       <button onClick={flush}>Save Now</button>
 *       <button onClick={() => forceSetValue("")}>Reset</button>
 *     </>
 *   );
 * }
 * ```
 *
 * @param initialValue - Initial state value, or a `useState`-style lazy
 * initializer function (`() => T`).
 * @param delay - See {@link useDebouncer}.
 * @param options - See {@link UseDebouncedStateOptions}.
 * @returns See {@link UseDebouncedStateReturn}.
 */
function useDebouncedState<T>(
	initialValue: T | (() => T),
	delay: number,
	options: UseDebouncedStateOptions<T> = {},
): UseDebouncedStateReturn<T> {
	if (
		isDev
		&& options.equalityFn !== undefined
		&& typeof options.equalityFn !== "function"
	) {
		console.warn(
			"[useDebouncedState] `equalityFn` must be a function — falling back to `Object.is`.",
		);
	}

	const equalityFn =
		typeof options.equalityFn === "function" ? options.equalityFn : Object.is;

	const [state, setState] = useState<T>(initialValue);

	// Tracks the value that WILL be committed once the current debounce
	// cycle resolves — distinct from `state`, which only reflects what's
	// already committed. Lets functional updaters (`(p) => p + 1`) chain
	// correctly across several calls made before the debounce settles,
	// since each call's `previous` should see the *scheduled* value, not
	// the stale committed one.
	const pendingValueRef = useRef<T>(state);

	const commitValue = useCallback(
		(value: T) => {
			setState((previous) => (equalityFn(previous, value) ? previous : value));
		},
		[equalityFn],
	);

	const {
		debouncedFunc: scheduleCommit,
		cancel: cancelDebounce,
		flush,
		isPending,
	} = useDebouncedCallback(commitValue, delay, options);

	const setDebouncedState = useCallback(
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
		cancelDebounce();

		// Resync the "next value" tracker back to whatever is actually
		// committed, now that the pending update has been discarded —
		// otherwise a subsequent functional update would build on a value
		// that was just thrown away.
		setState((current) => {
			pendingValueRef.current = current;

			return current;
		});
	}, [cancelDebounce]);

	const forceSetValue = useCallback(
		(valueOrUpdater: T | ((previous: T) => T)) => {
			cancelDebounce();

			setState((previous) => {
				const nextValue =
					isUpdaterFunction(valueOrUpdater) ?
						valueOrUpdater(previous)
					:	valueOrUpdater;

				pendingValueRef.current = nextValue;

				return nextValue;
			});
		},
		[cancelDebounce],
	);

	return [
		state,
		setDebouncedState,
		{ isPending, cancel, flush, forceSetValue },
	] as const;
}

export { type UseDebouncedStateReturn, useDebouncedState };
