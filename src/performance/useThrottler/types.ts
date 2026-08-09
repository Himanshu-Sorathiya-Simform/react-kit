import type { EqualityFnOption } from "../../shared/rateControlShared/types.ts";

/**
 * Configuration for `useThrottler` and every hook built on top of it.
 *
 * @remarks
 * `leading` and `trailing` may both be set to `false` at the same time —
 * the hook will not silently correct this for you. That configuration
 * means the throttled function will never run; a dev-mode warning is
 * logged to help catch it early, but the choice itself is respected.
 */
interface ThrottleOptions {
	/**
	 * When `true`, invokes immediately on the first call of a new cooldown
	 * window.
	 *
	 * @defaultValue `true`
	 */
	leading?: boolean;

	/**
	 * When `true`, invokes once more at the end of the cooldown window,
	 * using the most recently passed function/arguments — but only if at
	 * least one call arrived after the leading edge fired. A single
	 * isolated call with both edges enabled only fires once.
	 *
	 * @defaultValue `true`
	 */
	trailing?: boolean;
}

/**
 * Options for `useThrottledState`: all of {@link ThrottleOptions}, plus an
 * optional equality comparator used to skip committing a value equivalent
 * to the one already held.
 */
type UseThrottledStateOptions<T> = ThrottleOptions & EqualityFnOption<T>;

/**
 * Options for `useThrottledValue`: all of {@link ThrottleOptions}, plus an
 * optional equality comparator used to skip committing a value equivalent
 * to the one already held.
 */
type UseThrottledValueOptions<T> = ThrottleOptions & EqualityFnOption<T>;

export type {
	EqualityFnOption,
	ThrottleOptions,
	UseThrottledStateOptions,
	UseThrottledValueOptions,
};
