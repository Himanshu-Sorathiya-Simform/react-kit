import { useEffect } from "react";
import { resolveMod } from "../../shared/keysShared/platform.ts";
import { useEventListener } from "../useEventListener/useEventListener.ts";
import { NON_TEXT_INPUT_TYPES, validKeyEventTypes } from "./constants.ts";
import type { UseKeyOptions } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * A function that detaches the listener registered by `useKey` immediately,
 * without waiting for the component to unmount.
 *
 * Safe to call more than once. Note that this does not permanently disable
 * the hook: if `eventType`, `enabled`, `target`, or `capture` change
 * afterwards, a new listener may be attached again on the next render.
 * Changing `key` — or any of the modifier-matching options — does *not*
 * cause a re-attach; those are picked up fresh on the next keystroke
 * without the underlying listener ever being torn down.
 */
type UseKeyReturn = () => void;

/**
 * Calls `handler` when `key` is pressed (or released, depending on
 * `eventType`), optionally matching an exact combination of modifier keys.
 *
 * Ignores keystrokes that occur during IME composition (for example, while
 * typing pinyin or romaji before a CJK character is confirmed), so
 * shortcuts don't misfire or interfere with the IME's own confirmation key
 * — often Enter. By default, also ignores keystrokes while focus is inside
 * a text input, textarea, select, or contenteditable element — see
 * `ignoreWhenFocusedInInputs` in {@link UseKeyOptions}.
 *
 * @param key The key to match, compared case-insensitively against
 * `KeyboardEvent.key` (e.g. `"Escape"`, `"a"`, `"Enter"`).
 * @param handler Called with the native event when a match is found. Doesn't need to be
 * memoized.
 * @param options See {@link UseKeyOptions}.
 * @returns A function that detaches the listener on demand.
 *
 * @example
 * ```tsx
 * useKey("Escape", () => setOpen(false));
 * ```
 *
 * @example
 * Matching a modifier combination — all four modifier flags are matched
 * exactly, so this only fires for Ctrl+K alone, not Ctrl+Shift+K:
 * ```tsx
 * useKey("k", () => openCommandPalette(), { ctrlKey: true });
 * ```
 */
function useKey(
	key: string,
	handler: (event: KeyboardEvent) => void,
	options: UseKeyOptions = {},
): UseKeyReturn {
	const {
		enabled = true,
		preventDefault = true,
		stopPropagation = true,
		eventType = "keydown",
		preventRepeat = false,
		ignoreWhenFocusedInInputs = true,
		mod = false,
		ctrlKey = false,
		shiftKey = false,
		altKey = false,
		metaKey = false,
		capture = false,
		target,
	} = options;

	// The spacebar's real `KeyboardEvent.key` value is a literal " ", not the
	// word "Space" — normalized here so `useKey("Space", ...)` still matches,
	// the same way `formatKey` normalizes it in the other direction.
	const lowerKey = key.toLowerCase();
	const targetKey = lowerKey === "space" ? " " : lowerKey;

	useEffect(() => {
		if (isDev && targetKey === "") {
			console.warn(
				"[useKey] Called with an empty key — this listener will never match.",
			);
		}

		// `mod` and an explicit ctrlKey/metaKey are mutually exclusive at the
		// type level, but a plain-JS caller can still pass both — `mod`
		// takes full precedence in that case, so this only exists to flag
		// the ambiguity rather than let it resolve silently.
		if (isDev && mod && (ctrlKey || metaKey)) {
			console.warn(
				"[useKey] `mod` is combined with an explicit `ctrlKey`/`metaKey` — `mod` takes precedence and the explicit value is ignored.",
			);
		}

		if (isDev && !validKeyEventTypes.includes(eventType)) {
			console.warn(
				`[useKey] Invalid eventType "${eventType}" — falling back to "keydown". Valid values are: ${validKeyEventTypes.join(", ")}.`,
			);
		}
	}, [targetKey, mod, ctrlKey, metaKey, eventType]);

	const resolvedEventType =
		validKeyEventTypes.includes(eventType) ? eventType : "keydown";
	const shouldPreventRepeat = preventRepeat && resolvedEventType !== "keyup";

	// `mod` fully replaces ctrlKey/metaKey rather than combining with them —
	// resolved fresh each render, same cost class as `targetKey` above.
	const modResolved = mod ? resolveMod() : null;
	const requiredCtrlKey = modResolved ? modResolved.ctrlKey : ctrlKey;
	const requiredMetaKey = modResolved ? modResolved.metaKey : metaKey;

	const onKeyEvent = (event: Event) => {
		if (!(event instanceof KeyboardEvent)) return;

		if (event.isComposing || event.keyCode === 229) return;

		if (shouldPreventRepeat && event.repeat) return;

		const focusedElement = event.target;

		if (
			ignoreWhenFocusedInInputs
			&& focusedElement instanceof HTMLElement
			&& ((focusedElement instanceof HTMLInputElement
				&& !NON_TEXT_INPUT_TYPES.has(focusedElement.type))
				|| focusedElement instanceof HTMLTextAreaElement
				|| focusedElement instanceof HTMLSelectElement
				|| focusedElement.isContentEditable)
		) {
			return;
		}
		const matchesModifiers =
			event.ctrlKey === requiredCtrlKey
			&& event.shiftKey === shiftKey
			&& event.altKey === altKey
			&& event.metaKey === requiredMetaKey;

		if (!matchesModifiers || targetKey !== event.key.toLowerCase()) return;

		if (preventDefault) event.preventDefault();
		if (stopPropagation) event.stopPropagation();

		handler(event);
	};

	const resolvedTarget =
		enabled ? (target ?? (typeof window === "undefined" ? null : window)) : null;

	return useEventListener(resolvedEventType, onKeyEvent, {
		target: resolvedTarget,
		capture,
	});
}

export { useKey, type UseKeyReturn };
