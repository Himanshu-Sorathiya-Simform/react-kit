import { useEffect, useRef, useState } from "react";
import type { UseRateLimitedValueOptions } from "./types.ts";
import { useRateLimitedCallback } from "./useRateLimitedCallback.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The tuple returned by `useRateLimitedValue`.
 */
type UseRateLimitedValueReturn<T> = [
	/** The rate-limited mirror of the source value. */
	T,
	{
		/** See {@link UseRateLimiterReturn.remaining}. */
		remaining: number;
		/** See {@link UseRateLimiterReturn.isRateLimited}. */
		isRateLimited: boolean;
		/** See {@link UseRateLimiterReturn.reset}. */
		reset: () => void;
	},
];

/**
 * Mirrors `value`, but the mirror updates at most `limit` times per
 * `windowMs` window.
 *
 * @remarks
 * This has a meaningfully weaker guarantee than `useDebouncedValue` /
 * `useThrottledValue`. Those hooks eventually deliver the *latest* value
 * once their window settles, even if intermediate values were skipped.
 * This hook does not — once the allowance is exhausted, incoming changes
 * to `value` are dropped outright until the allowance refills, with no
 * queueing and no catch-up. The mirror simply stays frozen at whatever it
 * last committed until it's allowed to update again.
 *
 * @example
 * ```tsx
 * function NotificationFeed({ latestNotification }: { latestNotification: string }) {
 *   const [visibleNotification] = useRateLimitedValue(latestNotification, 3, 10_000);
 *
 *   // At most 3 notifications surface per 10s window; any beyond that
 *   // are silently dropped rather than queued for later display.
 *
 *   return <Toast message={visibleNotification} />;
 * }
 * ```
 *
 * @param value - The source value to rate-limit. Every change is subject
 * to the current allowance.
 * @param limit - See {@link useRateLimiter}.
 * @param windowMs - See {@link useRateLimiter}.
 * @param options - See {@link UseRateLimitedValueOptions}.
 * @returns See {@link UseRateLimitedValueReturn}.
 */
function useRateLimitedValue<T>(
	value: T,
	limit: number,
	windowMs: number,
	options: UseRateLimitedValueOptions<T> = {},
): UseRateLimitedValueReturn<T> {
	if (
		isDev
		&& options.equalityFn !== undefined
		&& typeof options.equalityFn !== "function"
	) {
		console.warn(
			"[useRateLimitedValue] `equalityFn` must be a function — falling back to `Object.is`.",
		);
	}

	const equalityFn =
		typeof options.equalityFn === "function" ? options.equalityFn : Object.is;

	const [rateLimitedValue, setRateLimitedValue] = useState<T>(value);

	const { rateLimitedFunc, reset, remaining, isRateLimited } =
		useRateLimitedCallback(
			(newValue: T) => {
				setRateLimitedValue((previous) =>
					equalityFn(previous, newValue) ? previous : newValue,
				);
			},
			limit,
			windowMs,
			options,
		);

	// Skips the sync on mount — `rateLimitedValue` already starts as
	// `value` via its own `useState` initializer, so syncing again here
	// would spend one of a possibly very small allowance for no reason.
	const isFirstRenderRef = useRef(true);

	useEffect(() => {
		if (isFirstRenderRef.current) {
			isFirstRenderRef.current = false;
			return;
		}

		rateLimitedFunc(value);
	}, [value, rateLimitedFunc]);

	return [rateLimitedValue, { remaining, isRateLimited, reset }] as const;
}

export { type UseRateLimitedValueReturn, useRateLimitedValue };
