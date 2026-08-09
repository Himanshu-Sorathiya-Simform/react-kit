import { useCallback, useEffect, useRef } from "react";
import type { DebounceOptions } from "./types.ts";
import { useDebouncer } from "./useDebouncer.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The object returned by `useDebouncedCallback`.
 */
interface UseDebouncedCallbackReturn<Args extends unknown[]> {
	/**
	 * A stable, debounced wrapper around `func`. Safe to call from any
	 * event handler; internally always invokes the most recently rendered
	 * `func`, even though `debouncedFunc`'s own identity doesn't change
	 * across re-renders.
	 */
	debouncedFunc: (...args: Args) => void;

	/** See {@link UseDebouncerReturn.cancel}. */
	cancel: () => void;

	/** See {@link UseDebouncerReturn.flush}. */
	flush: () => void;

	/** See {@link UseDebouncerReturn.isPending}. */
	isPending: boolean;
}

/**
 * Debounces a single function.
 *
 * `func` is captured in a ref and refreshed on every render — you can pass
 * a fresh inline closure every time without resetting the pending debounce
 * cycle, and the debounced wrapper always calls the *latest* `func`,
 * closing over whatever props/state were current when it actually fires
 * (never a stale closure from whenever the wrapper was first created).
 *
 * @example
 * ```tsx
 * function SearchBox() {
 *   const { debouncedFunc: handleSearch, isPending } = useDebouncedCallback(
 *     (query: string) => fetchResults(query),
 *     400,
 *   );
 *
 *   return (
 *     <>
 *       <input onChange={(e) => handleSearch(e.target.value)} />
 *       {isPending && <span>Typing…</span>}
 *     </>
 *   );
 * }
 * ```
 *
 * @param func - The function to debounce. Safe to pass a new closure on
 * every render.
 * @param delay - See {@link useDebouncer}.
 * @param options - See {@link DebounceOptions}.
 * @returns See {@link UseDebouncedCallbackReturn}.
 */
function useDebouncedCallback<Args extends unknown[]>(
	func: (...args: Args) => void,
	delay: number,
	options: DebounceOptions = {},
): UseDebouncedCallbackReturn<Args> {
	if (isDev && typeof func !== "function") {
		console.warn(
			`[useDebouncedCallback] Expected \`func\` to be a function, received ${typeof func}.`,
		);
	}

	// "Latest ref" pattern: keeps the freshest `func` available to
	// `debouncedFunc` without needing `debouncedFunc`'s own identity (or
	// the underlying timer) to change whenever `func`'s identity changes.
	const funcRef = useRef(func);

	useEffect(() => {
		funcRef.current = func;
	}, [func]);

	const { run, cancel, flush, isPending } = useDebouncer(delay, options);

	const debouncedFunc = useCallback(
		(...args: Args) => {
			run(funcRef.current, ...args);
		},
		[run],
	);

	return { debouncedFunc, cancel, flush, isPending };
}

export { type UseDebouncedCallbackReturn, useDebouncedCallback };
