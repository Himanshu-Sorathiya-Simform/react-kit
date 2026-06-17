/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react";

interface DebounceOptions {
	maxWait?: number;
	leading?: boolean;
	trailing?: boolean;
}

interface UseDebounceReturn<Args extends any[]> {
	debouncedFunc: (...args: Args) => void;
	cancel: () => void;
	flush: () => void;
	isPending: boolean;
}

function useDebounce<Args extends any[]>(
	func: (...args: Args) => void,
	delay: number,
	options: DebounceOptions = {},
): UseDebounceReturn<Args> {
	const [isPending, setIsPending] = useState(false);

	const maxWait = options.maxWait;
	const leading = !!options.leading;
	const trailing =
		!leading && options.trailing === false ?
			true
		:	(options.trailing ?? !leading);

	const funcRef = useRef(func);
	const timerIdRef = useRef<number | null>(null);
	const lastInvokeTimeRef = useRef(-1);
	const lastCallTimeRef = useRef(-1);
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
		lastCallTimeRef.current = -1;
		lastArgsRef.current = null;

		setIsPending(false);
	}, []);

	const flush = useCallback(() => {
		if (timerIdRef.current && lastArgsRef.current) {
			clearTimeout(timerIdRef.current);

			timerIdRef.current = null;

			funcRef.current(...lastArgsRef.current);

			lastInvokeTimeRef.current = Date.now();
			lastCallTimeRef.current = -1;
			lastArgsRef.current = null;

			setIsPending(false);
		}
	}, []);

	useEffect(() => {
		return () => {
			cancel();
		};
	}, [cancel]);

	const debouncedFunc = useCallback(
		(...args: Args) => {
			setIsPending(true);

			lastCallTimeRef.current = Date.now();
			lastArgsRef.current = args;

			if (lastInvokeTimeRef.current === -1) {
				lastInvokeTimeRef.current = Date.now();

				if (leading === true) {
					funcRef.current(...args);
				}
			}

			if (
				maxWait !== undefined
				&& Date.now() - lastInvokeTimeRef.current >= maxWait
			) {
				if (timerIdRef.current) clearTimeout(timerIdRef.current);

				funcRef.current(...args);

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
						funcRef.current(...args);
					}

					lastInvokeTimeRef.current = -1;

					setIsPending(false);
				}, delay);
			}
		},
		[delay, maxWait, trailing, leading],
	);

	return { debouncedFunc, cancel, flush, isPending };
}

export { type UseDebounceReturn, useDebounce };
