import { detectPlatform, resolveMod, type Platform } from "../../shared/keysShared/platform.ts";
import type { CanonicalModifier } from "../../shared/keysShared/types.ts";
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
import type { FormatKeyDescriptor, FormatKeyOptions } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

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

/** Looks up `key` in `map` ignoring case, since callers may pass it in any casing (matching `useKey`'s own case-insensitive `key` matching). */
function lookupKeyName<T>(map: Record<string, T>, key: string): T | undefined {
	const normalized = key.toLowerCase();

	for (const candidate in map) {
		if (candidate.toLowerCase() === normalized) return map[candidate];
	}

	return undefined;
}

function formatMainKey(key: string, useSymbols: boolean): string {
	// The spacebar's real `KeyboardEvent.key` value is a literal " ", not
	// the word "Space" the display maps below are keyed by — normalized
	// here so a descriptor built from a real event (or from `useKey`'s own
	// " " convention) still resolves to "␣"/"Space" instead of falling
	// through to a blank string.
	const normalizedKey = key === " " ? "Space" : key;

	if (useSymbols) {
		const symbol = lookupKeyName(KEY_DISPLAY_SYMBOLS, normalizedKey);
		if (symbol !== undefined) return symbol;
	}

	const textLabel = lookupKeyName(KEY_TEXT_LABELS, normalizedKey);

	if (textLabel !== undefined) return textLabel;

	const punctuationLabel = lookupKeyName(
		PUNCTUATION_KEY_DISPLAY_LABELS,
		normalizedKey,
	);

	if (punctuationLabel !== undefined) return punctuationLabel;

	if (normalizedKey.length === 1) return normalizedKey.toUpperCase();

	return normalizedKey.charAt(0).toUpperCase() + normalizedKey.slice(1);
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
	if (isDev && descriptor.key === "") {
		console.warn(
			"[formatKey] Called with an empty key — the formatted string may be incomplete.",
		);
	}

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

export { formatKey };
