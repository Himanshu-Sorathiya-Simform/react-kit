import { useSyncExternalStore } from "react";
import { getHeldKeys, subscribe } from "../../shared/keysShared/keyStateTracker.ts";

/** Every key currently held down — see {@link useHeldKeys}. */
type UseHeldKeysReturn = readonly string[];

/**
 * Returns every key currently held down, updating live as keys are pressed
 * and released.
 *
 * Backed by the same shared `window` keydown/keyup listener as
 * `useKeyHold` — attached lazily on first subscriber, removed once the
 * last one unmounts. The returned array is a stable reference between
 * renders whenever the held-key set hasn't actually changed, so it's safe
 * to pass directly into a `useEffect`/`useMemo` dependency array without
 * it re-running on every unrelated render.
 *
 * @returns The currently held keys, lowercased (e.g. `["shift", "a"]`) —
 * always an empty array during server-side rendering, since there's no
 * keyboard to read.
 *
 * @example
 * ```tsx
 * const heldKeys = useHeldKeys();
 * const isSaveComboHeld = heldKeys.includes("s") && heldKeys.includes("meta");
 * ```
 */
function useHeldKeys(): UseHeldKeysReturn {
	return useSyncExternalStore(subscribe, getHeldKeys, getHeldKeys);
}

export { useHeldKeys, type UseHeldKeysReturn };
