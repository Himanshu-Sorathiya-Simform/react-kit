import { useCallback, useEffect, useRef, useState } from "react";
import type { RateLimitOptions } from "./types.ts";

interface UseRateLimitReturn {
	run: <Args extends unknown[]>(
		func: (...args: Args) => void,
		...args: Args
	) => void;
	remaining: number;
	isRateLimited: boolean;
}

function useRateLimit(
	limit: number,
	windowMs: number,
	options?: RateLimitOptions,
): UseRateLimitReturn {
	const safeLimit = Math.max(1, Number(limit) || 1);
	const safeWindowMs = Math.max(0, Number(windowMs) || 0);

	const [remaining, setRemaining] = useState(safeLimit);

	const refillStrategy = options?.refillStrategy ?? "burst";

	const onRateLimitReachedRef = useRef(options?.onRateLimitReached);
	useEffect(() => {
		onRateLimitReachedRef.current = options?.onRateLimitReached;
	}, [options?.onRateLimitReached]);

	const tokensRef = useRef(safeLimit);

	const [initTime] = useState(() => Date.now());
	const lastRefillTimeRef = useRef(initTime);

	const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timerIdRef.current) clearTimeout(timerIdRef.current);
		};
	}, []);

	const run = useCallback(
		<Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => {
			const now = Date.now();
			const timePassed = now - lastRefillTimeRef.current;

			if (refillStrategy === "burst") {
				if (timePassed >= safeWindowMs) {
					tokensRef.current = safeLimit;
					lastRefillTimeRef.current = now;
				}
			} else {
				const timePerToken = safeWindowMs / safeLimit;
				const tokensToAdd = Math.floor(timePassed / timePerToken);

				if (tokensToAdd > 0) {
					tokensRef.current = Math.min(
						safeLimit,
						tokensRef.current + tokensToAdd,
					);
					lastRefillTimeRef.current += tokensToAdd * timePerToken;
				}
			}

			if (tokensRef.current > 0) {
				tokensRef.current -= 1;

				setRemaining(tokensRef.current);

				func(...args);
			} else {
				if (onRateLimitReachedRef.current) {
					onRateLimitReachedRef.current();
				}
			}

			if (timerIdRef.current) {
				clearTimeout(timerIdRef.current);
			}

			if (tokensRef.current < safeLimit) {
				const timePerToken = safeWindowMs / safeLimit;
				const nextRefillIn =
					refillStrategy === "burst" ?
						safeWindowMs - (Date.now() - lastRefillTimeRef.current)
					:	timePerToken - (Date.now() - lastRefillTimeRef.current);

				timerIdRef.current = setTimeout(
					() => {
						setRemaining((prev) => Math.min(safeLimit, prev + 1));

						lastRefillTimeRef.current = Date.now();

						tokensRef.current = Math.min(
							safeLimit,
							tokensRef.current + 1,
						);
					},
					Math.max(0, nextRefillIn),
				);
			}
		},
		[safeLimit, safeWindowMs, refillStrategy],
	);

	return { run, remaining, isRateLimited: remaining === 0 };
}

export { type UseRateLimitReturn, useRateLimit };
