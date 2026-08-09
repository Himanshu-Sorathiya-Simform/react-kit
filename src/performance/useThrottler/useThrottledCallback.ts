import { useCallback, useEffect, useRef } from "react";
import type { ThrottleOptions } from "./types.ts";
import { useThrottler } from "./useThrottler.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The object returned by `useThrottledCallback`.
 */
interface UseThrottledCallbackReturn<Args extends unknown[]> {
	/**
	 * A stable, throttled wrapper around `func`. Safe to attach directly
	 * to an event listener; internally always invokes the most recently
	 * rendered `func`, even though `throttledFunc`'s own identity doesn't
	 * change across re-renders.
	 */
	throttledFunc: (...args: Args) => void;

	/** See {@link UseThrottlerReturn.cancel}. */
	cancel: () => void;

	/** See {@link UseThrottlerReturn.flush}. */
	flush: () => void;

	/** See {@link UseThrottlerReturn.isPending}. */
	isPending: boolean;
}

/**
 * Throttles a single function.
 *
 * `func` is captured in a ref and refreshed on every render — you can pass
 * a fresh inline closure every time without resetting the running cooldown
 * window, and the throttled wrapper always calls the *latest* `func`,
 * closing over whatever props/state were current when it actually fires
 * (never a stale closure from whenever the wrapper was first created).
 *
 * @example
 * ```tsx
 * function WindowSizeLogger() {
 *   const { throttledFunc: handleResize } = useThrottledCallback(
 *     () => console.log("width:", window.innerWidth),
 *     200,
 *   );
 *
 *   useEffect(() => {
 *     window.addEventListener("resize", handleResize);
 *     return () => window.removeEventListener("resize", handleResize);
 *   }, [handleResize]);
 *
 *   return null;
 * }
 * ```
 *
 * @param func - The function to throttle. Safe to pass a new closure on
 * every render.
 * @param delay - See {@link useThrottler}.
 * @param options - See {@link ThrottleOptions}.
 * @returns See {@link UseThrottledCallbackReturn}.
 */
function useThrottledCallback<Args extends unknown[]>(
	func: (...args: Args) => void,
	delay: number,
	options: ThrottleOptions = {},
): UseThrottledCallbackReturn<Args> {
	if (isDev && typeof func !== "function") {
		console.warn(
			`[useThrottledCallback] Expected \`func\` to be a function, received ${typeof func}.`,
		);
	}

	// "Latest ref" pattern: keeps the freshest `func` available to
	// `throttledFunc` without needing `throttledFunc`'s own identity (or
	// the underlying timer) to change whenever `func`'s identity changes.
	const funcRef = useRef(func);

	useEffect(() => {
		funcRef.current = func;
	}, [func]);

	const { run, cancel, flush, isPending } = useThrottler(delay, options);

	const throttledFunc = useCallback(
		(...args: Args) => {
			run(funcRef.current, ...args);
		},
		[run],
	);

	return { throttledFunc, cancel, flush, isPending };
}

export { type UseThrottledCallbackReturn, useThrottledCallback };
