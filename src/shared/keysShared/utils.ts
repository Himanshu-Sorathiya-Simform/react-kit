import {
	KEY_DISPLAY_SYMBOLS,
	KEY_TEXT_LABELS,
	LINUX_MODIFIER_LABELS,
	MAC_MODIFIER_LABELS,
	MAC_MODIFIER_SYMBOLS,
	MODIFIER_ORDER,
	PUNCTUATION_KEY_DISPLAY_LABELS,
	WINDOWS_MODIFIER_LABELS,
} from "./constants.ts";
import { detectPlatform, resolveMod, type Platform } from "./platform.ts";
import type { CanonicalModifier, KeyModifiers } from "./types.ts";

/** A key combination to format — the same modifier shape `useKey` matches against, plus the key itself. */
type FormatKeyDescriptor = KeyModifiers & {
	key: string;
	shiftKey?: boolean;
	altKey?: boolean;
};

interface FormatKeyOptions {
	/**
	 * Overrides platform auto-detection — useful for rendering a shortcut
	 * for a platform other than the one the code is currently running on
	 * (e.g. a settings screen listing both mac and Windows bindings).
	 * @default detectPlatform()
	 */
	platform?: Platform;

	/**
	 * Whether to render glyphs — modifier symbols (⌘⌥⇧⌃, mac only) and
	 * special-key symbols (↵ ⌫ ⇥ ⎋ ↑ ↓ ← →, any platform) — instead of text
	 * labels. Modifiers only have glyphs on mac; Windows/Linux modifiers
	 * always render as text regardless of this option.
	 * @default true
	 */
	useSymbols?: boolean;
}

function modifierLabelsFor(platform: Platform): Record<CanonicalModifier, string> {
	if (platform === "mac") return MAC_MODIFIER_LABELS;

	if (platform === "linux") return LINUX_MODIFIER_LABELS;

	return WINDOWS_MODIFIER_LABELS;
}

function formatModifier(
	modifier: CanonicalModifier,
	platform: Platform,
	useSymbols: boolean,
): string {
	if (platform === "mac" && useSymbols) return MAC_MODIFIER_SYMBOLS[modifier];

	return modifierLabelsFor(platform)[modifier];
}

function formatMainKey(key: string, useSymbols: boolean): string {
	if (useSymbols && key in KEY_DISPLAY_SYMBOLS) return KEY_DISPLAY_SYMBOLS[key]!;

	if (key in KEY_TEXT_LABELS) return KEY_TEXT_LABELS[key]!;

	if (key in PUNCTUATION_KEY_DISPLAY_LABELS)
		return PUNCTUATION_KEY_DISPLAY_LABELS[key]!;

	return key.length === 1 ? key.toUpperCase() : key;
}

/**
 * Formats a key combination for display, resolving `mod` and modifier
 * symbols/labels for the given (or auto-detected) platform.
 *
 * @example
 * ```ts
 * formatKey({ key: "s", mod: true });
 * // "⌘ S" on mac, "Ctrl+S" on Windows/Linux
 *
 * formatKey({ key: "s", mod: true }, { useSymbols: false });
 * // "Cmd+S" on mac, "Ctrl+S" on Windows/Linux
 * ```
 */
function formatKey(
	descriptor: FormatKeyDescriptor,
	options: FormatKeyOptions = {},
): string {
	const platform = options.platform ?? detectPlatform();
	const useSymbols = options.useSymbols ?? true;

	const modResolved = descriptor.mod ? resolveMod(platform) : null;
	const ctrlKey =
		modResolved ? modResolved.ctrlKey : (descriptor.ctrlKey ?? false);
	const metaKey =
		modResolved ? modResolved.metaKey : (descriptor.metaKey ?? false);

	const activeState: Record<CanonicalModifier, boolean> = {
		Control: ctrlKey,
		Alt: descriptor.altKey ?? false,
		Shift: descriptor.shiftKey ?? false,
		Meta: metaKey,
	};
	const activeModifiers = MODIFIER_ORDER.filter(
		(modifier) => activeState[modifier],
	);

	// Matches the convention symbol-mode combinations use on mac — parts
	// joined with a space (e.g. "⌘ ⇧ Z"); every other case, including mac
	// in label mode ("Cmd+Shift+Z"), joins with "+".
	const separator = platform === "mac" && useSymbols ? " " : "+";

	const parts = [
		...activeModifiers.map((modifier) =>
			formatModifier(modifier, platform, useSymbols),
		),
		formatMainKey(descriptor.key, useSymbols),
	];

	return parts.join(separator);
}

export { formatKey, type FormatKeyDescriptor, type FormatKeyOptions };
