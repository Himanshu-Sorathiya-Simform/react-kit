import { useCallback, useEffect, useRef, useState } from "react";
import type { ThrottleOptions } from "./types.ts";

interface UseThrottleReturn {
	run: <Args extends unknown[]>(
		func: (...args: Args) => void,
		...args: Args
	) => void;
	cancel: () => void;
	flush: () => void;
	isPending: boolean;
}

function useThrottle(
	delay: number,
	options: ThrottleOptions = {},
): UseThrottleReturn {
	const safeDelay = Math.max(0, Number(delay) || 0);

	const [isPending, setIsPending] = useState(false);

	let leading = options?.leading ?? true;
	let trailing = options?.trailing ?? true;

	if (leading === false && trailing === false) {
		leading = true;
		trailing = true;
	}

	const activeFuncRef = useRef<((...args: unknown[]) => void) | null>(null);
	const lastArgsRef = useRef<unknown[] | null>(null);

	const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastInvokeTimeRef = useRef(-1);

	const cancel = useCallback(() => {
		if (timerIdRef.current) {
			clearTimeout(timerIdRef.current);
			timerIdRef.current = null;
		}

		lastInvokeTimeRef.current = -1;
		lastArgsRef.current = null;
		activeFuncRef.current = null;

		setIsPending(false);
	}, []);

	const flush = useCallback(() => {
		if (lastArgsRef.current && activeFuncRef.current) {
			if (timerIdRef.current) {
				clearTimeout(timerIdRef.current);
				timerIdRef.current = null;
			}

			activeFuncRef.current(...lastArgsRef.current);
			lastInvokeTimeRef.current = leading ? Date.now() : -1;

			lastArgsRef.current = null;
			activeFuncRef.current = null;

			setIsPending(false);
		}
	}, [leading]);

	useEffect(() => {
		return () => {
			cancel();
		};
	}, [cancel]);

	const run = useCallback(
		<Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => {
			setIsPending(true);

			const now = Date.now();
			lastArgsRef.current = args;
			activeFuncRef.current = func as (...args: unknown[]) => void;

			if (
				lastInvokeTimeRef.current === -1 ?
					leading
				:	now - lastInvokeTimeRef.current >= safeDelay
			) {
				if (timerIdRef.current) {
					clearTimeout(timerIdRef.current);
					timerIdRef.current = null;
				}

				activeFuncRef.current(...args);

				lastInvokeTimeRef.current = now;
				lastArgsRef.current = null;

				setIsPending(false);
			} else if (!timerIdRef.current) {
				const elapsed =
					lastInvokeTimeRef.current === -1 ?
						0
					:	now - lastInvokeTimeRef.current;
				const remainingTime = safeDelay - elapsed;

				timerIdRef.current = setTimeout(() => {
					if (trailing && lastArgsRef.current && activeFuncRef.current) {
						activeFuncRef.current(...lastArgsRef.current);
						lastInvokeTimeRef.current = leading ? Date.now() : -1;
					} else {
						lastInvokeTimeRef.current = -1;
					}

					lastArgsRef.current = null;
					activeFuncRef.current = null;
					timerIdRef.current = null;

					setIsPending(false);
				}, remainingTime);
			}
		},
		[safeDelay, leading, trailing],
	);

	return { run, cancel, flush, isPending };
}

export { type UseThrottleReturn, useThrottle };
