import type { RefObject } from "react";
import type { validKeyEventTypes } from "./constants.ts";

/**
 * The keyboard event types `useKey` can listen for. See
 * {@link validKeyEventTypes}.
 */
type KeyEventType = (typeof validKeyEventTypes)[number];

/**
 * Options shared by both variants of {@link UseKeyOptions}.
 */
interface UseKeyBaseOptions {
	/**
	 * Whether the listener is active. Setting this to `false` fully detaches
	 * the underlying listener rather than just skipping the check on each
	 * keystroke, so there's no runtime cost while disabled.
	 *
	 * @default true
	 */
	enabled?: boolean;

	/**
	 * The element, ref, `window`, or `document` to attach the listener to.
	 *
	 * @default window
	 */
	target?: RefObject<HTMLElement | null> | HTMLElement | Window | Document | null;

	/**
	 * Whether to call `event.preventDefault()` when `key` matches. Applied
	 * before `handler` is called, so it still takes effect even if `handler`
	 * throws.
	 *
	 * @default true
	 */
	preventDefault?: boolean;

	/**
	 * Whether to call `event.stopPropagation()` when `key` matches. Applied
	 * before `handler` is called, so it still takes effect even if `handler`
	 * throws.
	 *
	 * @default true
	 */
	stopPropagation?: boolean;

	/**
	 * Whether the listener is registered in the capture phase.
	 *
	 * Unlike `useClickOutside`, this defaults to `false`. Flip it to `true`
	 * if a descendant element calling `event.stopPropagation()` is
	 * preventing this shortcut from firing.
	 *
	 * @default false
	 */
	capture?: boolean;

	/**
	 * Whether to ignore the keystroke while focus is inside an `<input>`,
	 * `<textarea>`, `<select>`, or any `contenteditable` element — so a
	 * shortcut like a bare `"s"` doesn't fire while someone is just typing.
	 *
	 * @default true
	 */
	ignoreWhenFocusedInInputs?: boolean;

	/**
	 * Whether the Ctrl key must be held for a match.
	 * @default false
	 */
	ctrlKey?: boolean;

	/**
	 * Whether the Shift key must be held for a match.
	 * @default false
	 */
	shiftKey?: boolean;

	/**
	 * Whether the Alt key (Option, on Mac) must be held for a match.
	 * @default false
	 */
	altKey?: boolean;

	/**
	 * Whether the Meta key (Cmd on Mac, the Windows key elsewhere) must be
	 * held for a match.
	 * @default false
	 */
	metaKey?: boolean;
}

/**
 * Options accepted by `useKey`.
 *
 * `preventRepeat` is only valid together with `eventType: "keydown"` or
 * `"keypress"` — TypeScript rejects it on `"keyup"`, since a keyup event is
 * never marked as auto-repeating.
 */
type UseKeyOptions = UseKeyBaseOptions
	& (
		| {
				/**
				 * Which keyboard event to listen for.
				 * @default "keydown"
				 */
				eventType?: Extract<KeyEventType, "keydown" | "keypress">;
				/**
				 * If `true`, ignores auto-repeated events fired while the key is
				 * held down (based on the native `KeyboardEvent.repeat` flag), so
				 * `handler` only fires once per physical press rather than
				 * repeatedly while it's held.
				 *
				 * @default false
				 */
				preventRepeat?: boolean;
		  }
		| { eventType: Extract<KeyEventType, "keyup">; preventRepeat?: never }
	);

export type { KeyEventType, UseKeyBaseOptions, UseKeyOptions };
