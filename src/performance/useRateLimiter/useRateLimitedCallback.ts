import { useCallback, useEffect, useRef } from "react";
import type { RateLimitOptions } from "./types.ts";
import { useRateLimiter } from "./useRateLimiter.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The object returned by `useRateLimitedCallback`.
 */
interface UseRateLimitedCallbackReturn<Args extends unknown[]> {
	/**
	 * A stable, rate-limited wrapper around `func`. Always invokes the
	 * most recently rendered `func`, even though `rateLimitedFunc`'s own
	 * identity doesn't change across re-renders.
	 *
	 * @returns `true` if `func` was invoked, `false` if the call was
	 * rejected because the allowance is exhausted.
	 */
	rateLimitedFunc: (...args: Args) => boolean;

	/** See {@link UseRateLimiterReturn.reset}. */
	reset: () => void;

	/** See {@link UseRateLimiterReturn.remaining}. */
	remaining: number;

	/** See {@link UseRateLimiterReturn.isRateLimited}. */
	isRateLimited: boolean;
}

/**
 * Rate-limits a single function.
 *
 * `func` is captured in a ref and refreshed on every render — you can
 * pass a fresh inline closure every time without resetting the
 * underlying allowance tracking, and the wrapper always calls the
 * *latest* `func`.
 *
 * @example
 * ```tsx
 * function SearchBox() {
 *   const { rateLimitedFunc, isRateLimited } = useRateLimitedCallback(
 *     (query: string) => fetch(`/api/search?q=${query}`),
 *     10,
 *     60_000,
 *     { refillStrategy: "gradual" },
 *   );
 *
 *   return (
 *     <input
 *       disabled={isRateLimited}
 *       onChange={(e) => rateLimitedFunc(e.target.value)}
 *     />
 *   );
 * }
 * ```
 *
 * @param func - The function to rate-limit. Safe to pass a new closure
 * on every render.
 * @param limit - See {@link useRateLimiter}.
 * @param windowMs - See {@link useRateLimiter}.
 * @param options - See {@link RateLimitOptions}.
 * @returns See {@link UseRateLimitedCallbackReturn}.
 */
function useRateLimitedCallback<Args extends unknown[]>(
	func: (...args: Args) => void,
	limit: number,
	windowMs: number,
	options?: RateLimitOptions,
): UseRateLimitedCallbackReturn<Args> {
	if (isDev && typeof func !== "function") {
		console.warn(
			`[useRateLimitedCallback] Expected \`func\` to be a function, received ${typeof func}.`,
		);
	}

	const funcRef = useRef(func);

	useEffect(() => {
		funcRef.current = func;
	}, [func]);

	const { run, reset, remaining, isRateLimited } = useRateLimiter(
		limit,
		windowMs,
		options,
	);

	const rateLimitedFunc = useCallback(
		(...args: Args) => run(funcRef.current, ...args),
		[run],
	);

	return { rateLimitedFunc, reset, remaining, isRateLimited };
}

export { type UseRateLimitedCallbackReturn, useRateLimitedCallback };
