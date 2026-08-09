import type { EqualityFnOption } from "../../shared/rateControlShared/types.ts";

/**
 * Configuration for `useRateLimiter` and every hook built on top of it.
 */
interface RateLimitOptions {
	/**
	 * Called whenever a call is rejected because no executions remain in
	 * the current window.
	 *
	 * Safe to pass a fresh inline function on every render — it's captured
	 * in a ref and refreshed via effect, so it never causes the underlying
	 * timers to reset.
	 *
	 * @defaultValue `undefined`
	 */
	onRateLimitReached?: () => void;

	/**
	 * Determines how the allowance replenishes once consumed.
	 *
	 * - `"burst"` — fixed window. All executions reset to the full `limit`
	 *   at once, only once the entire `windowMs` duration has elapsed
	 *   since the window began.
	 * - `"gradual"` — trickle refill. Executions return proportionately as
	 *   time passes (`windowMs / limit` per execution), with no hard reset
	 *   boundary.
	 *
	 * @defaultValue `"burst"`
	 */
	refillStrategy?: "burst" | "gradual";
}

/**
 * Options for `useRateLimitedState`: all of {@link RateLimitOptions}, plus
 * an optional equality comparator used to skip committing a value
 * equivalent to the one already held.
 */
type UseRateLimitedStateOptions<T> = RateLimitOptions & EqualityFnOption<T>;

/**
 * Options for `useRateLimitedValue`: all of {@link RateLimitOptions}, plus
 * an optional equality comparator used to skip committing a value
 * equivalent to the one already held.
 */
type UseRateLimitedValueOptions<T> = RateLimitOptions & EqualityFnOption<T>;

export type {
	EqualityFnOption,
	RateLimitOptions,
	UseRateLimitedStateOptions,
	UseRateLimitedValueOptions,
};
