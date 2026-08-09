import { useCallback, useEffect, useRef, useState } from "react";
import type { RateLimitOptions } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The object returned by `useRateLimiter`.
 */
interface UseRateLimiterReturn {
	/**
	 * Attempts to invoke `func` (with `args`) against the current
	 * allowance.
	 *
	 * Unlike `useDebouncer`/`useThrottler`, nothing here is ever deferred —
	 * every call to `run()` resolves synchronously, right now: either an
	 * execution is available and `func` runs immediately, or it isn't and
	 * `func` doesn't run at all (no queueing, no later catch-up).
	 *
	 * Each call accepts its own function, so a single `useRateLimiter`
	 * instance can gate several different actions against one shared
	 * allowance if needed.
	 *
	 * @returns `true` if `func` was invoked, `false` if the call was
	 * rejected because the current window's allowance is exhausted.
	 *
	 * @example
	 * ```ts
	 * const { run } = useRateLimiter(3, 10_000);
	 *
	 * const didFire = run(() => submitForm());
	 * if (!didFire) showToast("Too many attempts — please wait.");
	 * ```
	 */
	run: <Args extends unknown[]>(
		func: (...args: Args) => void,
		...args: Args
	) => boolean;

	/**
	 * Immediately restores the full allowance and clears any in-progress
	 * background refill, bypassing the normal window/refill timing
	 * entirely. Useful after an unrelated event that should grant a fresh
	 * allowance outright — e.g. a successful CAPTCHA, or a plan upgrade.
	 */
	reset: () => void;

	/**
	 * The number of executions currently available. Kept accurate in real
	 * time — including while idle, with no further calls to `run()` —
	 * by a self-scheduling background timer that mirrors whichever
	 * `refillStrategy` is configured.
	 */
	remaining: number;

	/** Convenience flag, equivalent to `remaining === 0`. */
	isRateLimited: boolean;
}

/**
 * The rate-limiting engine underlying every hook in this family.
 *
 * `useRateLimiter` grants up to `limit` executions per `windowMs` window,
 * replenished according to `refillStrategy`. Unlike debounce or throttle,
 * it never delays or reshapes *when* something runs — every call is an
 * immediate accept-or-reject decision against the current allowance.
 *
 * Most consumers won't reach for this directly — `useRateLimitedCallback`,
 * `useRateLimitedState`, and `useRateLimitedValue` are thin, purpose-built
 * wrappers around it for the common cases.
 *
 * @example
 * ```tsx
 * function SubmitButton() {
 *   const { run, remaining, isRateLimited } = useRateLimiter(3, 10_000, {
 *     refillStrategy: "burst",
 *     onRateLimitReached: () => toast("Too many attempts."),
 *   });
 *
 *   return (
 *     <button onClick={() => run(submitForm)} disabled={isRateLimited}>
 *       Submit ({remaining} left)
 *     </button>
 *   );
 * }
 * ```
 *
 * @param limit - Maximum executions allowed per window. Coerced to a
 * non-negative integer with a floor of `1`; invalid input falls back to
 * `1` with a dev-mode warning.
 * @param windowMs - Length of the rate-limit window, in milliseconds.
 * Coerced to a non-negative number; invalid input falls back to `0` with
 * a dev-mode warning. A value of `0` disables rate limiting entirely
 * (every call is allowed) rather than causing a division error — also
 * dev-warned, since it's rarely intentional.
 * @param options - See {@link RateLimitOptions}.
 * @returns See {@link UseRateLimiterReturn}.
 */
function useRateLimiter(
	limit: number,
	windowMs: number,
	options?: RateLimitOptions,
): UseRateLimiterReturn {
	const safeLimit = Math.max(1, Math.floor(Number(limit) || 1));
	const safeWindowMs = Math.max(0, Number(windowMs) || 0);

	if (
		isDev
		&& (typeof limit !== "number" || !Number.isFinite(limit) || limit < 1)
	) {
		console.warn(
			`[useRateLimiter] Received an invalid \`limit\` (${String(limit)}) — falling back to ${safeLimit}.`,
		);
	}

	if (
		isDev
		&& (typeof windowMs !== "number"
			|| !Number.isFinite(windowMs)
			|| windowMs < 0)
	) {
		console.warn(
			`[useRateLimiter] Received an invalid \`windowMs\` (${String(windowMs)}) — falling back to ${safeWindowMs}ms.`,
		);
	}

	if (isDev && safeWindowMs === 0) {
		console.warn(
			"[useRateLimiter] `windowMs` is 0 — rate limiting is effectively disabled; every call will be allowed.",
		);
	}

	if (
		isDev
		&& options?.refillStrategy !== undefined
		&& options.refillStrategy !== "burst"
		&& options.refillStrategy !== "gradual"
	) {
		console.warn(
			`[useRateLimiter] \`refillStrategy\` must be "burst" or "gradual", received "${String(options.refillStrategy)}" — falling back to "burst".`,
		);
	}

	if (
		isDev
		&& options?.onRateLimitReached !== undefined
		&& typeof options.onRateLimitReached !== "function"
	) {
		console.warn(
			"[useRateLimiter] `onRateLimitReached` must be a function — ignoring the provided value.",
		);
	}

	const [remaining, setRemaining] = useState(safeLimit);

	const refillStrategy =
		options?.refillStrategy === "gradual" ? "gradual" : "burst";

	// "Latest ref" pattern, validated up front so a bad value can never
	// reach the `?.()` call site below and throw at runtime.
	const onRateLimitReachedRef = useRef(
		typeof options?.onRateLimitReached === "function" ?
			options.onRateLimitReached
		:	undefined,
	);

	useEffect(() => {
		onRateLimitReachedRef.current =
			typeof options?.onRateLimitReached === "function" ?
				options.onRateLimitReached
			:	undefined;
	}, [options?.onRateLimitReached]);

	// `tokensRef` is the source of truth; `remaining` (state) exists only
	// to make that number reactive for rendering. Every place that writes
	// `tokensRef.current` also calls `setRemaining` to keep them in sync.
	const tokensRef = useRef(safeLimit);
	const lastRefillTimeRef = useRef(Date.now());
	const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timerIdRef.current !== null) clearTimeout(timerIdRef.current);
		};
	}, []);

	// Single source of truth for "how many executions should be available
	// right now, given how much time has passed" — shared by both the
	// on-demand catch-up check in `run()` and the proactive background
	// timer in `scheduleRefill()`, so the two can never disagree.
	const refillTokens = useCallback(() => {
		if (safeWindowMs === 0) {
			if (tokensRef.current !== safeLimit) {
				tokensRef.current = safeLimit;
				setRemaining(safeLimit);
			}
			return;
		}

		const now = Date.now();
		const timePassed = now - lastRefillTimeRef.current;

		if (refillStrategy === "burst") {
			if (timePassed >= safeWindowMs && tokensRef.current !== safeLimit) {
				tokensRef.current = safeLimit;
				lastRefillTimeRef.current = now;
				setRemaining(safeLimit);
			}
			return;
		}

		const timePerToken = safeWindowMs / safeLimit;
		const tokensToAdd = Math.floor(timePassed / timePerToken);

		if (tokensToAdd > 0) {
			tokensRef.current = Math.min(safeLimit, tokensRef.current + tokensToAdd);
			// Advances by exactly the time "spent" on the tokens just
			// added — not reset to `now` — so no fractional progress
			// toward the next token is ever lost.
			lastRefillTimeRef.current += tokensToAdd * timePerToken;
			setRemaining(tokensRef.current);
		}
	}, [refillStrategy, safeWindowMs, safeLimit]);

	// Keeps `remaining` accurate in real time even with no further calls
	// to `run()`, by rescheduling itself after every tick until the
	// allowance is fully replenished.
	const scheduleRefill = useCallback(
		function doSchedule() {
			if (timerIdRef.current !== null) {
				clearTimeout(timerIdRef.current);
				timerIdRef.current = null;
			}

			if (tokensRef.current >= safeLimit || safeWindowMs === 0) return;

			const timePerToken = safeWindowMs / safeLimit;
			const elapsed = Date.now() - lastRefillTimeRef.current;
			const nextRefillIn =
				refillStrategy === "burst" ?
					safeWindowMs - elapsed
				:	timePerToken - elapsed;

			timerIdRef.current = setTimeout(
				() => {
					timerIdRef.current = null;

					refillTokens();
					doSchedule();
				},
				Math.max(0, nextRefillIn),
			);
		},
		[safeLimit, safeWindowMs, refillStrategy, refillTokens],
	);

	const reset = useCallback(() => {
		if (timerIdRef.current !== null) {
			clearTimeout(timerIdRef.current);
			timerIdRef.current = null;
		}

		tokensRef.current = safeLimit;
		lastRefillTimeRef.current = Date.now();

		setRemaining(safeLimit);
	}, [safeLimit]);

	const run = useCallback(
		<Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => {
			refillTokens();

			if (tokensRef.current > 0) {
				tokensRef.current -= 1;

				setRemaining(tokensRef.current);

				scheduleRefill();

				// Invoked last, after all internal bookkeeping is settled,
				// so a throwing `func` can never leave the limiter's own
				// state inconsistent.
				func(...args);

				return true;
			}

			onRateLimitReachedRef.current?.();

			scheduleRefill();

			return false;
		},
		[refillTokens, scheduleRefill],
	);

	return { run, reset, remaining, isRateLimited: remaining === 0 };
}

export { type UseRateLimiterReturn, useRateLimiter };
