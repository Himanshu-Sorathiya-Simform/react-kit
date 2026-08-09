import type { EqualityFnOption } from "../../shared/rateControlShared/types.ts";

/**
 * Configuration for `useDebouncer` and every hook built on top of it.
 *
 * @remarks
 * `leading` and `trailing` may both be set to `false` at the same time —
 * the hook will not silently correct this for you. That configuration
 * means the debounced function will never run; a dev-mode warning is
 * logged to help catch it early, but the choice itself is respected.
 */
interface DebounceOptions {
	/**
	 * A hard ceiling, in milliseconds, on how long invocation can be
	 * deferred. If a continuous stream of calls keeps pushing the trailing
	 * timer out, `maxWait` forces a synchronous invocation once this many
	 * milliseconds have elapsed since the current cycle began — regardless
	 * of whether the trailing window has settled yet.
	 *
	 * Only evaluated at the moment `run()` is called; it is not an
	 * independent background timer, so it can't fire while no calls are
	 * coming in.
	 *
	 * @defaultValue `undefined` (no ceiling)
	 */
	maxWait?: number;

	/**
	 * When `true`, invokes on the leading edge — immediately, on the first
	 * call of a new debounce cycle (i.e. when no cycle is currently active).
	 *
	 * @defaultValue `false`
	 */
	leading?: boolean;

	/**
	 * When `true`, invokes on the trailing edge — once `delay` milliseconds
	 * have elapsed with no further calls.
	 *
	 * Defaults to `true` regardless of `leading`'s value. With
	 * `{ leading: true, trailing: true }` (both edges enabled), a single
	 * isolated call only fires once (the leading edge) — the trailing edge
	 * only fires if at least one more call arrives before the window
	 * closes.
	 *
	 * @defaultValue `true`
	 */
	trailing?: boolean;
}

/**
 * Options for `useDebouncedState`: all of {@link DebounceOptions}, plus an
 * optional equality comparator used to skip committing a value equivalent
 * to the one already held.
 */
type UseDebouncedStateOptions<T> = DebounceOptions & EqualityFnOption<T>;

/**
 * Options for `useDebouncedValue`: all of {@link DebounceOptions}, plus an
 * optional equality comparator used to skip committing a value equivalent
 * to the one already held.
 */
type UseDebouncedValueOptions<T> = DebounceOptions & EqualityFnOption<T>;

export type {
	DebounceOptions,
	EqualityFnOption,
	UseDebouncedStateOptions,
	UseDebouncedValueOptions,
};
