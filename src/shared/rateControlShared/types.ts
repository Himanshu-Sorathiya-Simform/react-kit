/**
 * Adds an optional custom equality comparator to any hook that manages a
 * value and needs to decide whether a "new" value is actually different
 * enough to justify a re-render.
 *
 * Used by the `State` and `Value` variants of debounce/throttle/rate-limit
 * (e.g. `useDebouncedValue`, `useThrottledState`) to avoid committing a
 * value that is deeply/semantically equal to the value already held,
 * which would otherwise trigger a wasted re-render.
 *
 * @example
 * ```tsx
 * useDebouncedValue(user, 300, {
 *   equalityFn: (previous, next) => previous.id === next.id,
 * });
 * ```
 */
interface EqualityFnOption<T> {
	/**
	 * Called with the currently-held value and the candidate next value.
	 * Return `true` if they should be treated as equal (no update should be
	 * committed); return `false` to allow the update through.
	 *
	 * Defaults to `Object.is` when omitted, or when an invalid (non-function)
	 * value is provided — see the consuming hook's dev-mode warning.
	 */
	equalityFn?: (previous: T, next: T) => boolean;
}

export type { EqualityFnOption };
