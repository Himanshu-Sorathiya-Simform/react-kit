import { useCallback, useEffect, useRef, useState } from "react";
import type { ThrottleOptions } from "./types.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface UseThrottleReturn<Args extends any[]> {
	throttledFunc: (...args: Args) => void;
	cancel: () => void;
	flush: () => void;
	isPending: boolean;
}

function useThrottle<Args extends any[]>(
	func: (...args: Args) => void,
	delay: number,
	options: ThrottleOptions = {},
): UseThrottleReturn<Args> {
	const [isPending, setIsPending] = useState(false);

	const leading = options.leading ?? true;
	const trailing = options.trailing ?? true;

	const funcRef = useRef(func);
	const timerIdRef = useRef<number | null>(null);
	const lastInvokeTimeRef = useRef(-1);
	const lastArgsRef = useRef<Args | null>(null);

	useEffect(() => {
		funcRef.current = func;
	}, [func]);

	const cancel = useCallback(() => {
		if (timerIdRef.current) {
			clearTimeout(timerIdRef.current);

			timerIdRef.current = null;
		}

		lastInvokeTimeRef.current = -1;
		lastArgsRef.current = null;

		setIsPending(false);
	}, []);

	const flush = useCallback(() => {
		if (lastArgsRef.current) {
			if (timerIdRef.current) {
				clearTimeout(timerIdRef.current);

				timerIdRef.current = null;
			}

			funcRef.current(...lastArgsRef.current);
			lastInvokeTimeRef.current = leading ? Date.now() : -1;
			lastArgsRef.current = null;

			setIsPending(false);
		}
	}, [leading]);

	useEffect(() => {
		return () => {
			cancel();
		};
	}, [cancel]);

	const throttledFunc = useCallback(
		(...args: Args) => {
			setIsPending(true);

			const now = Date.now();
			lastArgsRef.current = args;

			if (
				lastInvokeTimeRef.current === -1 ?
					leading
				:	now - lastInvokeTimeRef.current >= delay
			) {
				if (timerIdRef.current) {
					clearTimeout(timerIdRef.current);
					timerIdRef.current = null;
				}

				funcRef.current(...args);

				lastInvokeTimeRef.current = now;
				lastArgsRef.current = null;

				setIsPending(false);
			} else if (!timerIdRef.current) {
				const elapsed =
					lastInvokeTimeRef.current === -1 ?
						0
					:	now - lastInvokeTimeRef.current;
				const remainingTime = delay - elapsed;

				timerIdRef.current = setTimeout(() => {
					if (trailing && lastArgsRef.current) {
						funcRef.current(...lastArgsRef.current);

						lastInvokeTimeRef.current = leading ? Date.now() : -1;
					} else {
						lastInvokeTimeRef.current = -1;
					}

					lastArgsRef.current = null;
					timerIdRef.current = null;

					setIsPending(false);
				}, remainingTime);
			}
		},
		[delay, leading, trailing],
	);

	return { throttledFunc, cancel, flush, isPending };
}

export { type ThrottleOptions, type UseThrottleReturn, useThrottle };
