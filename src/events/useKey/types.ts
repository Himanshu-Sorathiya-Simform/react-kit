import type { RefObject } from "react";
import type { KeyModifiers } from "../../shared/keysShared/types.ts";
import type { validKeyEventTypes } from "./constants.ts";

type KeyEventType = (typeof validKeyEventTypes)[number];

interface UseKeyBaseOptions {
	/**
	 * Whether the listener is active. Setting this to `false` fully detaches
	 * the underlying listener rather than just skipping the check on each
	 * keystroke, so there's no runtime cost while disabled.
	 * @default true
	 */
	enabled?: boolean;

	/**
	 * The element, ref, `window`, or `document` to attach the listener to —
	 * an `HTMLElement` or a focusable `SVGElement` (e.g. `<svg tabIndex={0}>`)
	 * both work.
	 * @default window
	 */
	target?:
		| RefObject<HTMLElement | SVGElement | null>
		| HTMLElement
		| SVGElement
		| Window
		| Document
		| null;

	/**
	 * Whether to call `event.preventDefault()` when `key` matches. Applied
	 * before `handler` is called, so it still takes effect even if `handler`
	 * throws.
	 * @default true
	 */
	preventDefault?: boolean;

	/**
	 * Whether to call `event.stopPropagation()` when `key` matches. Applied
	 * before `handler` is called, so it still takes effect even if `handler`
	 * throws.
	 * @default true
	 */
	stopPropagation?: boolean;

	/**
	 * Whether the listener is registered in the capture phase.
	 * @default false
	 */
	capture?: boolean;

	/**
	 * Whether to ignore the keystroke while focus is inside an `<input>`,
	 * `<textarea>`, `<select>`, or any `contenteditable` element.
	 * @default true
	 */
	ignoreWhenFocusedInInputs?: boolean;

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
}

type UseKeyOptions = UseKeyBaseOptions
	& KeyModifiers
	& (
		| {
				/**
				 * Which keyboard event to listen for.
				 * @default "keydown"
				 */
				eventType?: Extract<KeyEventType, "keydown" | "keypress">;
				/**
				 * If `true`, ignores auto-repeated events fired while the key is
				 * held down (based on the native `KeyboardEvent.repeat` flag).
				 * @default false
				 */
				preventRepeat?: boolean;
		  }
		| { eventType: Extract<KeyEventType, "keyup">; preventRepeat?: never }
	);

export type { KeyEventType, UseKeyBaseOptions, UseKeyOptions };

