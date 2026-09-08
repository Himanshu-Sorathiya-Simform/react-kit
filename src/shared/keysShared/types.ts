/**
 * The four modifier keys a hotkey can require, in the order they're
 * displayed in.
 */
type CanonicalModifier = "Control" | "Alt" | "Shift" | "Meta";

/**
 * Modifier-matching state for a single key combination. `mod` is mutually
 * exclusive with `ctrlKey`/`metaKey` — it stands for "whichever one
 * applies on the current platform," so combining it with an explicit
 * `ctrlKey`/`metaKey` leaves it ambiguous which one should win. A
 * combination that genuinely needs both modifiers held at once can set
 * `ctrlKey: true, metaKey: true` directly instead of using `mod`.
 */
type KeyModifiers =
	| {
			/**
			 * Whether the platform's primary modifier must be held for a
			 * match — Meta (Cmd) on mac, Control on Windows/Linux — resolved
			 * via `detectPlatform()`.
			 * @default false
			 */
			mod?: boolean;
			ctrlKey?: never;
			metaKey?: never;
	  }
	| {
			mod?: never;
			/**
			 * Whether the Ctrl key must be held for a match.
			 * @default false
			 */
			ctrlKey?: boolean;
			/**
			 * Whether the Meta key (Cmd on Mac, the Windows key elsewhere)
			 * must be held for a match.
			 * @default false
			 */
			metaKey?: boolean;
	  };

export type { CanonicalModifier, KeyModifiers };
