import type { RefObject } from "react";

/**
 * The native event that triggered a `useClickOutside` handler. Determined
 * by whichever `eventType` was configured — `MouseEvent` for
 * `click`/`mousedown`/`mouseup`, `TouchEvent` for `touchstart`/`touchend`,
 * `PointerEvent` for `pointerdown`/`pointerup`.
 */
type ClickOutsideEvent = MouseEvent | TouchEvent | PointerEvent | Event;

/**
 * A single element to check clicks against, or `null` if it isn't mounted
 * yet.
 */
type ClickOutsideTarget = Element | null;

/**
 * A way of referring to a single {@link ClickOutsideTarget}: a React ref
 * that will (eventually) point at the element, the element itself, or
 * `null`.
 *
 * A ref whose `current` is `null` — for example, because the element hasn't
 * mounted yet — is treated as "outside" for that entry rather than blocking
 * detection. See `useClickOutside`'s docs for details.
 */
type ClickOutsideTargetRef = RefObject<ClickOutsideTarget> | ClickOutsideTarget;

/**
 * Native events `useClickOutside` can listen for. Defaults to `mousedown`
 * and `touchstart`, which fire before `click`/`mouseup` — this avoids
 * misfiring when a user starts a drag or text selection inside the target
 * and releases outside it.
 */
type ClickOutsideEventName =
	| "mousedown"
	| "mouseup"
	| "click"
	| "touchstart"
	| "touchend"
	| "pointerdown"
	| "pointerup";

/**
 * Options accepted by `useClickOutside`.
 */
interface UseClickOutsideOptions {
	/**
	 * Whether the listener is active. Setting this to `false` fully detaches
	 * the underlying listener rather than just skipping the check on each
	 * click, so there's no runtime cost while disabled.
	 *
	 * @default true
	 */
	enabled?: boolean;

	/**
	 * The event(s) that count as a "click." See {@link ClickOutsideEventName}
	 * for why `mousedown`/`touchstart` are the default.
	 *
	 * @default ["mousedown", "touchstart"]
	 */
	eventType?: ClickOutsideEventName | ClickOutsideEventName[];

	/**
	 * Whether the listener is registered in the capture phase.
	 *
	 * Defaults to `true` so this keeps working even if some element between
	 * the click and `document` calls `event.stopPropagation()` — a common
	 * cause of "click outside stopped working" bugs in bubble-phase
	 * listeners.
	 *
	 * @default true
	 */
	capture?: boolean;
}

export type {
	ClickOutsideEvent,
	ClickOutsideEventName,
	ClickOutsideTarget,
	ClickOutsideTargetRef,
	UseClickOutsideOptions,
};
