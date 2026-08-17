import type { RefObject } from "react";

/**
 * How to tell {@link useIntersectionObserver} what to observe.
 *
 * @remarks
 * Three shapes are accepted, matching the `getScrollElement`-style
 * convention used elsewhere in this library:
 * - **omitted / `undefined`** - ref-callback mode. Attach the hook's
 *   returned `ref` to your own JSX element.
 * - **`null`** - explicitly disabled; nothing is observed regardless of
 *   `enabled`.
 * - **an element, a `RefObject`, or a getter function**
 *   (`() => Element | null`) - resolved on every render, so it's safe to
 *   pass e.g. `() => someRef.current` without memoizing it.
 *
 * Unlike {@link ResizeObserverTargetInput}, there's no `Document`/`Window`
 * option here - the native `IntersectionObserver.observe()` only accepts an
 * `Element`.
 */
type IntersectionTargetInput =
	| Element
	| RefObject<Element | null>
	| (() => Element | null)
	| null;

/** Options for {@link useIntersectionObserver}. */
interface UseIntersectionObserverOptions {
	/**
	 * External target to observe.
	 *
	 * @defaultValue `undefined` (ref-callback mode - see {@link IntersectionTargetInput})
	 */
	target?: IntersectionTargetInput;

	/**
	 * The element (or `Document`) used as the viewport when checking for
	 * intersection.
	 *
	 * @defaultValue `null` (the browser viewport)
	 */
	root?: Element | Document | null | undefined;

	/**
	 * Margin added around `root`'s bounding box before computing
	 * intersections, in CSS `margin` shorthand syntax (e.g. `"200px 0px"`
	 * to start intersecting 200px early, useful for pre-triggering
	 * lazy-loads slightly before an element is actually on screen).
	 *
	 * @defaultValue `"0px"`
	 */
	rootMargin?: string | undefined;

	/**
	 * The intersection ratio (or ratios) at which the callback fires. A
	 * single number fires once past that ratio; an array fires at each
	 * threshold crossed, useful for progressive/scroll-linked effects.
	 *
	 * @defaultValue `0` (fires as soon as even one pixel is visible)
	 */
	threshold?: number | number[] | undefined;

	/**
	 * Pause observing without unmounting - `isIntersecting` and
	 * `intersectionRatio` are retained at their last values, just no longer
	 * updated.
	 *
	 * @defaultValue `true`
	 */
	enabled?: boolean | undefined;

	/**
	 * Once the target intersects for the first time, disconnect the
	 * observer and leave `isIntersecting` latched at `true` permanently (for
	 * this target - a new target gets a fresh chance). Useful for
	 * lazy-load-once patterns, where there's no need to keep paying for
	 * observation after the content has already loaded.
	 *
	 * @defaultValue `false`
	 */
	freezeOnceVisible?: boolean | undefined;

	/**
	 * Value returned before the first observation resolves.
	 *
	 * @defaultValue `false`
	 */
	initialIsIntersecting?: boolean | undefined;

	/**
	 * Debounce state updates by this many milliseconds. `0` applies every
	 * observation immediately.
	 *
	 * @defaultValue `0`
	 */
	debounceMs?: number | undefined;

	/**
	 * Imperative callback fired on every observation update, in addition to
	 * (not instead of) the hook's returned state updating.
	 *
	 * @param isIntersecting - Whether the target currently intersects `root`.
	 * @param entry - The raw `IntersectionObserverEntry` for this observation.
	 */
	onChange?: (
		isIntersecting: boolean,
		entry: IntersectionObserverEntry,
	) => void | undefined;
}

export type { IntersectionTargetInput, UseIntersectionObserverOptions };
