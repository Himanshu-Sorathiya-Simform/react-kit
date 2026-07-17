import { useCallback, useEffect, useRef } from "react";
import type { ThrottleOptions } from "./types.ts";
import { useThrottle } from "./useThrottle";

interface UseThrottledCallbackReturn<Args extends unknown[]> {
	throttledFunc: (...args: Args) => void;
	cancel: () => void;
	flush: () => void;
	isPending: boolean;
}

function useThrottledCallback<Args extends unknown[]>(
	func: (...args: Args) => void,
	delay: number,
	options: ThrottleOptions = {},
): UseThrottledCallbackReturn<Args> {
	const funcRef = useRef(func);

	useEffect(() => {
		funcRef.current = func;
	}, [func]);

	const { run, cancel, flush, isPending } = useThrottle(delay, options);

	const throttledFunc = useCallback(
		(...args: Args) => {
			run(funcRef.current, ...args);
		},
		[run],
	);

	return { throttledFunc, cancel, flush, isPending };
}

export { type UseThrottledCallbackReturn, useThrottledCallback };
