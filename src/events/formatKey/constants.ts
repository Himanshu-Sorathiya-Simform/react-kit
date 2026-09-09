import type { CanonicalModifier } from "../../shared/keysShared/types.ts";

/** Canonical modifier order used when composing a display string. */
const MODIFIER_ORDER: readonly CanonicalModifier[] = [
	"Control",
	"Alt",
	"Shift",
	"Meta",
];

/** mac modifier glyphs. */
const MAC_MODIFIER_SYMBOLS: Record<CanonicalModifier, string> = {
	Control: "⌃",
	Alt: "⌥",
	Shift: "⇧",
	Meta: "⌘",
};

/** mac modifier text labels, used when `useSymbols` is false. */
const MAC_MODIFIER_LABELS: Record<CanonicalModifier, string> = {
	Control: "Control",
	Alt: "Option",
	Shift: "Shift",
	Meta: "Cmd",
};

/** Windows modifier text labels — modifiers never have glyphs off mac. */
const WINDOWS_MODIFIER_LABELS: Record<CanonicalModifier, string> = {
	Control: "Ctrl",
	Alt: "Alt",
	Shift: "Shift",
	Meta: "Win",
};

/** Linux shares Windows' labels except for the Meta/Super key. */
const LINUX_MODIFIER_LABELS: Record<CanonicalModifier, string> = {
	...WINDOWS_MODIFIER_LABELS,
	Meta: "Super",
};

/**
 * Glyphs for non-modifier keys that read better as a symbol than as their
 * raw `KeyboardEvent.key` value. Platform-independent — these are common
 * conventions across operating systems and apps, not mac-specific
 * iconography like the modifier symbols above.
 */
const KEY_DISPLAY_SYMBOLS: Record<string, string> = {
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	Enter: "↵",
	Escape: "Esc",
	Backspace: "⌫",
	Delete: "⌦",
	Tab: "⇥",
	Space: "␣",
};

/** Plain-text equivalents of {@link KEY_DISPLAY_SYMBOLS}, used when `useSymbols` is false. */
const KEY_TEXT_LABELS: Record<string, string> = {
	ArrowUp: "Up",
	ArrowDown: "Down",
	ArrowLeft: "Left",
	ArrowRight: "Right",
	Enter: "Enter",
	Escape: "Escape",
	Backspace: "Backspace",
	Delete: "Delete",
	Tab: "Tab",
	Space: "Space",
};

/**
 * Punctuation characters shown as a readable word instead of the raw
 * character, since a bare symbol like "," is easy to misread next to a
 * modifier separator.
 */
const PUNCTUATION_KEY_DISPLAY_LABELS: Record<string, string> = {
	"`": "Backquote",
	"\\": "Backslash",
	"[": "Left Bracket",
	"]": "Right Bracket",
	",": "Comma",
	"=": "Equal",
	"-": "Minus",
	".": "Period",
	";": "Semicolon",
	"/": "Slash",
	"'": "Quote",
};

export {
	KEY_DISPLAY_SYMBOLS,
	KEY_TEXT_LABELS,
	LINUX_MODIFIER_LABELS,
	MAC_MODIFIER_LABELS,
	MAC_MODIFIER_SYMBOLS,
	MODIFIER_ORDER,
	PUNCTUATION_KEY_DISPLAY_LABELS,
	WINDOWS_MODIFIER_LABELS,
};
