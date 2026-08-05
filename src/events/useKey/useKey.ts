import { useEffect } from "react";
import { useEventListener } from "../useEventListener/useEventListener.ts";
import { validKeyEventTypes } from "./constants.ts";
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
		ctrlKey = false,
		shiftKey = false,
		altKey = false,
		metaKey = false,
		capture = false,
		target,
	} = options;

	const targetKey = key.toLowerCase();

	useEffect(() => {
		if (isDev && targetKey === "") {
			console.warn(
				"[useKey] Called with an empty key — this listener will never match.",
			);
		}
		// An effect (rather than a warn-once ref) is enough here: this only
		// re-runs when `targetKey` actually changes, not on every keystroke,
		// so there's no spam risk to guard against.
	}, [targetKey]);

	// Defensive at runtime, not just at the type level — protects
	// non-TypeScript callers (or anyone bypassing the types) from an
	// unrecognized eventType silently attaching to nothing.
	const resolvedEventType =
		validKeyEventTypes.includes(eventType) ? eventType : "keydown";
	// keyup events are never marked auto-repeating, so this only matters for
	// keydown/keypress — also enforced at the type level in UseKeyOptions.
	const shouldPreventRepeat = preventRepeat && resolvedEventType !== "keyup";

	const onKeyEvent = (event: Event) => {
		if (!(event instanceof KeyboardEvent)) return;

		// Bail out during IME composition (e.g. typing pinyin/romaji before a
		// CJK character is confirmed). keydown events fire throughout
		// composition, and matching against them would misfire shortcuts or
		// swallow the IME's own confirmation keystroke. `keyCode === 229` is
		// a legacy Chromium marker for the same condition, checked alongside
		// `isComposing` for older/edge cases.
		if (event.isComposing || event.keyCode === 229) return;

		// Uses the native `repeat` flag rather than manual keyup/blur
		// tracking — simpler and accurate for the single-key case this hook
		// targets. (There's a known, narrow Chromium bug affecting `.repeat`
		// when multiple different keys are held simultaneously; not a
		// concern for typical single hotkey/combo usage.)
		if (shouldPreventRepeat && event.repeat) return;

		const focusedElement = event.target;

		if (
			ignoreWhenFocusedInInputs
			&& focusedElement instanceof HTMLElement
			&& (focusedElement instanceof HTMLInputElement
				|| focusedElement instanceof HTMLTextAreaElement
				|| focusedElement instanceof HTMLSelectElement
				|| focusedElement.isContentEditable)
		) {
			return;
		}

		const matchesModifiers =
			event.ctrlKey === ctrlKey
			&& event.shiftKey === shiftKey
			&& event.altKey === altKey
			&& event.metaKey === metaKey;

		if (!matchesModifiers || targetKey !== event.key.toLowerCase()) return;

		// Applied before calling `handler`, so this still takes effect even
		// if `handler` throws.
		if (preventDefault) event.preventDefault();
		if (stopPropagation) event.stopPropagation();

		handler(event);
	};

	// Resolved here (rather than left as `undefined` for useEventListener's
	// own default-to-window logic) for two reasons: it lets `enabled` gate
	// the target to `null` to fully detach the listener when disabled, and
	// it keeps the value's type free of `undefined`, which is required for
	// useEventListener's generic-target overload to resolve correctly here.
	const resolvedTarget =
		enabled ? (target ?? (typeof window === "undefined" ? null : window)) : null;

	return useEventListener(resolvedEventType, onKeyEvent, {
		target: resolvedTarget,
		capture,
		// `passive` is intentionally left at its default (`false`): this
		// hook conditionally calls preventDefault(), which passive listeners
		// are not allowed to do.
	});
}

export { type UseKeyReturn, useKey };
