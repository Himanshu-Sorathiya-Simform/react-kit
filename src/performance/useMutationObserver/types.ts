import type { RefObject } from "react";

/**
 * How to tell {@link useMutationObserver} what to observe.
 *
 * @remarks
 * Three shapes are accepted, matching the `getScrollElement`-style
 * convention used elsewhere in this library:
 * - **omitted / `undefined`** - ref-callback mode. Attach the hook's
 *   returned `ref` to your own JSX element.
 * - **`null`** - explicitly disabled; nothing is observed regardless of
 *   `enabled`.
 * - **a `Node`, a `RefObject`, or a getter function** (`() => Node | null`)
 *   - resolved on every render, so it's safe to pass e.g.
 *   `() => someRef.current` without memoizing it.
 *
 * Typed as `Node` (rather than `Element`, like {@link IntersectionTargetInput})
 * because the native `MutationObserver.observe()` accepts any `Node` -
 * `Document` and `DocumentFragment` included, not just elements.
 */
type MutationTargetInput =
	| Node
	| RefObject<Node | null>
	| (() => Node | null)
	| null;

/**
 * Options for {@link useMutationObserver}.
 *
 * @remarks
 * Extends the native `MutationObserverInit` directly, so `childList`,
 * `attributes`, `attributeFilter`, `attributeOldValue`, `characterData`,
 * `characterDataOldValue`, and `subtree` all work exactly as documented for
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe | MutationObserver.observe()} -
 * this hook doesn't change their meaning or defaults, just forwards them.
 * Note the native API throws if `attributeFilter`/`attributeOldValue` are
 * set while `attributes` is explicitly `false`.
 */
interface UseMutationObserverOptions {
	/**
	 * External target to observe.
	 *
	 * @defaultValue `undefined` (ref-callback mode - see {@link MutationTargetInput})
	 */
	target?: MutationTargetInput;

	/**
	 * Pause observing without unmounting - the last delivered `records` are
	 * retained, just no longer updated.
	 *
	 * @defaultValue `true`
	 */
	enabled?: boolean | undefined;

	/**
	 * Debounce state updates by this many milliseconds. `0` applies every
	 * batch immediately. Note the native `MutationObserver` already batches
	 * synchronous mutations into one callback per microtask on its own -
	 * this further throttles the resulting React re-renders on top of that,
	 * useful when mutations arrive in frequent, independent bursts.
	 *
	 * @defaultValue `0`
	 */
	debounceMs?: number | undefined;

	/**
	 * Imperative callback fired on every batch of mutations, in addition to
	 * (not instead of) the hook's returned `records` state updating.
	 *
	 * @param mutations - The batch of records delivered by the native observer.
	 * @param observer - The underlying `MutationObserver` instance, e.g. to call `.takeRecords()` from within the callback.
	 */
	onMutate?: (
		mutations: MutationRecord[],
		observer: MutationObserver,
	) => void | undefined;

	childList?: boolean | undefined;
	attributes?: boolean | undefined;
	attributeFilter?: string[] | undefined;
	attributeOldValue?: boolean | undefined;
	characterData?: boolean | undefined;
	characterDataOldValue?: boolean | undefined;
	subtree?: boolean | undefined;
}

export type { MutationTargetInput, UseMutationObserverOptions };
