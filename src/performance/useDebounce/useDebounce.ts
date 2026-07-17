import { useCallback, useEffect, useRef, useState } from "react";
import type { DebounceOptions } from "./types.ts";

interface UseDebounceReturn {
	run: <Args extends unknown[]>(
		func: (...args: Args) => void,
		...args: Args
	) => void;
	cancel: () => void;
	flush: () => void;
	isPending: boolean;
}

function useDebounce(
	delay: number,
	options: DebounceOptions = {},
): UseDebounceReturn {
	const safeDelay = Math.max(0, Number(delay) || 0);

	const [isPending, setIsPending] = useState(false);

	const maxWait = options?.maxWait;
	const leading = !!options?.leading;
	const trailing =
		!leading && options?.trailing === false ?
			true
		:	(options?.trailing ?? !leading);

	const activeFuncRef = useRef<((...args: unknown[]) => void) | null>(null);
	const lastArgsRef = useRef<unknown[] | null>(null);

	const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastInvokeTimeRef = useRef(-1);
	const lastCallTimeRef = useRef(-1);

	const cancel = useCallback(() => {
		if (timerIdRef.current) {
			clearTimeout(timerIdRef.current);

			timerIdRef.current = null;
		}

		lastInvokeTimeRef.current = -1;
		lastCallTimeRef.current = -1;
		lastArgsRef.current = null;
		activeFuncRef.current = null;

		setIsPending(false);
	}, []);

	const flush = useCallback(() => {
		if (timerIdRef.current && activeFuncRef.current && lastArgsRef.current) {
			clearTimeout(timerIdRef.current);

			timerIdRef.current = null;

			activeFuncRef.current(...lastArgsRef.current);

			lastInvokeTimeRef.current = Date.now();
			lastCallTimeRef.current = -1;
			lastArgsRef.current = null;
			activeFuncRef.current = null;

			setIsPending(false);
		}
	}, []);

	useEffect(() => {
		return () => {
			cancel();
		};
	}, [cancel]);

	const run = useCallback(
		<Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => {
			setIsPending(true);

			lastCallTimeRef.current = Date.now();
			lastArgsRef.current = args;
			activeFuncRef.current = func as (...args: unknown[]) => void;

			if (lastInvokeTimeRef.current === -1) {
				lastInvokeTimeRef.current = Date.now();

				if (leading === true) {
					activeFuncRef.current(...args);
				}
			}

			if (
				maxWait !== undefined
				&& Date.now() - lastInvokeTimeRef.current >= maxWait
			) {
				if (timerIdRef.current) clearTimeout(timerIdRef.current);

				if (activeFuncRef.current) activeFuncRef.current(...args);

				lastInvokeTimeRef.current = -1;

				setIsPending(false);
			} else {
				if (timerIdRef.current) {
					clearTimeout(timerIdRef.current);
				}

				timerIdRef.current = setTimeout(() => {
					if (
						lastCallTimeRef.current !== lastInvokeTimeRef.current
						&& trailing !== false
					) {
						if (activeFuncRef.current && lastArgsRef.current) {
							activeFuncRef.current(...lastArgsRef.current);
						}
					}

					lastInvokeTimeRef.current = -1;

					setIsPending(false);
				}, safeDelay);
			}
		},
		[safeDelay, maxWait, trailing, leading],
	);

	return { run, cancel, flush, isPending };
}

export { type UseDebounceReturn, useDebounce };
