import { useCallback, useEffect, useRef } from "react";
import type { RateLimitOptions } from "./types.ts";
import { useRateLimit } from "./useRateLimit";

interface UseRateLimitedCallbackReturn<Args extends unknown[]> {
	rateLimitedFunc: (...args: Args) => void;
	remaining: number;
	isRateLimited: boolean;
}

function useRateLimitedCallback<Args extends unknown[]>(
	func: (...args: Args) => void,
	limit: number,
	windowMs: number,
	options?: RateLimitOptions,
): UseRateLimitedCallbackReturn<Args> {
	const funcRef = useRef(func);

	useEffect(() => {
		funcRef.current = func;
	}, [func]);

	const { run, remaining, isRateLimited } = useRateLimit(limit, windowMs, options);

	const rateLimitedFunc = useCallback(
		(...args: Args) => {
			run(funcRef.current, ...args);
		},
		[run],
	);

	return { rateLimitedFunc, remaining, isRateLimited };
}

export { type UseRateLimitedCallbackReturn, useRateLimitedCallback };
