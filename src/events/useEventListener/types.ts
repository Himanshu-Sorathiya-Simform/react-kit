import type { RefObject } from "react";

/**
 * Any valid DOM event target — the broadest type a listener can be attached
 * to. Used as the generic constraint for {@link UseEventListenerOptions} and
 * {@link TargetRef}.
 */
type TargetType = EventTarget;

/**
 * A way of referring to a listener target: a React ref that will
 * (eventually) point at the target, the target itself, or `null`.
 *
 * Passing `null` — or a ref whose `current` is `null` — means no listener is
 * attached.
 */
type TargetRef<T extends TargetType> = RefObject<T | null> | T | null;

/**
 * Options accepted by `useEventListener`, extending the native
 * `AddEventListenerOptions` (`capture`, `passive`, `once`) with a `target`
 * to attach to.
 */
interface UseEventListenerOptions<
	T extends TargetType,
> extends AddEventListenerOptions {
	/**
	 * The element, ref, `window`, or `document` to attach the listener to.
	 *
	 * - Omitted → defaults to `window` (or does nothing during SSR, where
	 *   `window` doesn't exist).
	 * - `null`, or a ref whose `current` is `null` → no listener is attached.
	 */
	target?: TargetRef<T>;

	/**
	 * An `AbortSignal` to detach the listener(s) from outside the hook.
	 *
	 * This is combined with the hook's own internal cleanup — aborting this
	 * signal detaches the listener(s) immediately, the same as calling the
	 * function the hook returns.
	 */
	signal?: AbortSignal;
}

export type { TargetRef, TargetType, UseEventListenerOptions };
