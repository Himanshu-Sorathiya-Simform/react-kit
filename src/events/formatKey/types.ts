import type { KeyModifiers } from "../../shared/keysShared/types.ts";
import type { Platform } from "../../shared/keysShared/platform.ts";

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

export type { FormatKeyDescriptor, FormatKeyOptions };
