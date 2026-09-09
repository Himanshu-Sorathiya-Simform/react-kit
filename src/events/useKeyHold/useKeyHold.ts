import { useEffect, useSyncExternalStore } from "react";
import { isKeyHeld, subscribe } from "../../shared/keysShared/keyStateTracker.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/** Whether the watched key is currently held down — see {@link useKeyHold}. */
type UseKeyHoldReturn = boolean;

/**
 * Returns whether `key` is currently held down, updating live as it's
 * pressed and released.
 *
 * Backed by a single shared `window` keydown/keyup listener rather than one
 * per call — attached lazily the first time any `useKeyHold` (or
 * `useHeldKeys`) call anywhere in the app subscribes, and removed once the
 * last one unmounts, so there's no tracking overhead at all unless
 * something is actually watching held-key state.
 *
 * @param key The key to watch, compared case-insensitively against
 * `KeyboardEvent.key` (e.g. `"Shift"`, `"a"`, `"Control"`).
 * @returns `true` while `key` is held down, `false` otherwise — and always
 * `false` during server-side rendering, since there's no keyboard to read.
 *
 * @example
 * ```tsx
 * const isShiftHeld = useKeyHold("Shift");
 * ```
 */
function useKeyHold(key: string): UseKeyHoldReturn {
	// The spacebar's real `KeyboardEvent.key` value is a literal " ", not the
	// word "Space" — normalized here so `useKeyHold("Space")` still matches,
	// mirroring the same normalization in `useKey`.
	const lowerKey = key.toLowerCase();
	const targetKey = lowerKey === "space" ? " " : lowerKey;

	useEffect(() => {
		if (isDev && targetKey === "") {
			console.warn(
				"[useKeyHold] Called with an empty key — this will never report as held.",
			);
		}
	}, [targetKey]);

	return useSyncExternalStore(
		subscribe,
		() => isKeyHeld(targetKey),
		() => false,
	);
}

export { useKeyHold, type UseKeyHoldReturn };

