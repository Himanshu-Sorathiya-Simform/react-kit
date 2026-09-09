import { detectPlatform } from "./platform.ts";

/**
 * Stable empty snapshot, reused so "nothing held" — the initial state, SSR,
 * or right after a window blur clears everything — always reads back the
 * same array reference rather than a new one each time.
 */
const EMPTY_HELD_KEYS: readonly string[] = [];

/**
 * Keys currently held down, normalized via `key.toLowerCase()` — the same
 * normalization `useKey` already applies to its `key` match.
 */
const heldKeys = new Set<string>();

/**
 * Array snapshot of `heldKeys`, kept in sync by `commitChange` below rather
 * than recomputed on every read — `useSyncExternalStore` needs `getSnapshot`
 * to return a referentially stable value when nothing has changed, or it
 * will treat every read as a change.
 */
let heldKeysSnapshot: readonly string[] = EMPTY_HELD_KEYS;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Refreshes the array snapshot and notifies subscribers — the only place either happens, so the two can never drift out of sync. */
function commitChange(): void {
	heldKeysSnapshot = heldKeys.size === 0 ? EMPTY_HELD_KEYS : Array.from(heldKeys);

	for (const listener of listeners) listener();
}

const MODIFIER_KEYS = new Set(["control", "alt", "shift", "meta"]);

/**
 * Maps every currently-down physical key — `KeyboardEvent.code`, e.g.
 * `"Equal"` — to the normalized `key` label it produced, e.g. `"+"` if
 * Shift was held at the time it went down.
 *
 * Tracking by `code` (which identifies the physical key and never changes
 * while it's held, regardless of what other modifiers do) rather than by
 * `key` directly (which can) is what makes release reliable: holding
 * Shift, pressing `=` (reported as `"+"`), then releasing Shift *before*
 * releasing `=` fires a `keyup` whose `key` is back to `"="` — plain `key`
 * matching would never find the `"+"` entry to clear it, leaving it stuck
 * held until the next `blur`. Looking the release up by `code` instead
 * always finds the right entry regardless of what `key` the `keyup`
 * reports.
 */
const codeToKey = new Map<string, string>();

/**
 * How many currently-down codes resolve to each `key` label. More than one
 * physical key can share a label at once — Left Shift and Right Shift both
 * report `key: "Shift"` — so a label should only leave `heldKeys` once
 * every code that produced it has been released, not as soon as the first
 * one is.
 */
const keyRefCounts = new Map<string, number>();

/**
 * Registers `code` as down, resolving to `key`. Returns whether `key`
 * newly entered `heldKeys` — `false` if another code already held that
 * same label, or if `code` itself was already down (an OS auto-repeat
 * `keydown`, which fires with the same `code` over and over).
 */
function markCodeDown(code: string, key: string): boolean {
	if (codeToKey.has(code)) return false;

	codeToKey.set(code, key);

	const nextCount = (keyRefCounts.get(key) ?? 0) + 1;
	keyRefCounts.set(key, nextCount);

	if (nextCount > 1) return false;

	heldKeys.add(key);

	return true;
}

/**
 * Releases `code`. Returns whether its `key` label just left `heldKeys` —
 * `false` if another code still resolves to the same label, or if `code`
 * wasn't tracked as down in the first place.
 */
function markCodeUp(code: string): boolean {
	const key = codeToKey.get(code);

	if (key === undefined) return false;

	codeToKey.delete(code);

	const nextCount = (keyRefCounts.get(key) ?? 1) - 1;

	if (nextCount > 0) {
		keyRefCounts.set(key, nextCount);

		return false;
	}

	keyRefCounts.delete(key);
	heldKeys.delete(key);

	return true;
}

/** Clears every tracked code/key/refcount — shared by `blur` and by the last subscriber tearing down. */
function resetTrackedState(): void {
	codeToKey.clear();
	keyRefCounts.clear();
	heldKeys.clear();
}

function handleKeyDown(event: KeyboardEvent): void {
	const key = event.key.toLowerCase();
	// `code` identifies the physical key independent of modifier state; it
	// falls back to `key` only for the rare synthetic/dispatched event that
	// omits `code` entirely.
	const code = event.code || key;

	if (markCodeDown(code, key)) commitChange();
}

function handleKeyUp(event: KeyboardEvent): void {
	const key = event.key.toLowerCase();
	const code = event.code || key;

	if (key === "meta" && detectPlatform() === "mac") {
		// On macOS, the OS swallows the keyup for any non-modifier key
		// released while Meta (Cmd) is still held — the browser only sees
		// Meta's own keyup once Cmd itself is released, so that's treated
		// as an implicit release for every non-modifier key still marked
		// held. Other modifiers are left alone, since they get their own
		// reliable keyup regardless of Meta's state — and this correction
		// is scoped to mac specifically, since on Windows/Linux a
		// non-modifier key still marked held when Meta is released really
		// would mean it's still physically held down.
		let changed = markCodeUp(code);

		for (const [heldCode, heldKey] of codeToKey) {
			if (!MODIFIER_KEYS.has(heldKey) && markCodeUp(heldCode)) {
				changed = true;
			}
		}

		if (changed) commitChange();

		return;
	}

	if (markCodeUp(code)) commitChange();
}

function handleBlur(): void {
	// The window losing focus — alt-tabbing away, a devtools panel
	// stealing it, and so on — means no keyup will ever arrive for
	// whatever's currently marked held, so it would otherwise appear
	// permanently "stuck" held once the window regains focus.
	if (heldKeys.size === 0) return;

	resetTrackedState();

	commitChange();
}

/**
 * Subscribes to changes in the held-key set. The underlying `window`
 * listeners are attached on the first subscriber and removed once the last
 * one unsubscribes, so there's a single shared listener set no matter how
 * many `useKeyHold`/`useHeldKeys` calls are mounted at once — not one per
 * call — and no listener at all when nothing is subscribed.
 *
 * Registered in the capture phase so the tracker still sees every keydown
 * and keyup even if a descendant element — including `useKey` itself,
 * which defaults to `stopPropagation: true` — stops the event from
 * reaching `window` in the bubble phase.
 */
function subscribe(listener: Listener): () => void {
	if (typeof window === "undefined") return () => {};

	if (listeners.size === 0) {
		window.addEventListener("keydown", handleKeyDown, { capture: true });
		window.addEventListener("keyup", handleKeyUp, { capture: true });
		window.addEventListener("blur", handleBlur, { capture: true });
	}

	listeners.add(listener);

	return () => {
		listeners.delete(listener);

		if (listeners.size === 0) {
			window.removeEventListener("keydown", handleKeyDown, { capture: true });
			window.removeEventListener("keyup", handleKeyUp, { capture: true });
			window.removeEventListener("blur", handleBlur, { capture: true });
			resetTrackedState();
			heldKeysSnapshot = EMPTY_HELD_KEYS;
		}
	};
}

/** Whether `key` — already normalized to lowercase by the caller — is currently held down. */
function isKeyHeld(key: string): boolean {
	return heldKeys.has(key);
}

/** The current array snapshot of held keys — see `heldKeysSnapshot` above for why this is cached rather than rebuilt per call. */
function getHeldKeys(): readonly string[] {
	return heldKeysSnapshot;
}

export { getHeldKeys, isKeyHeld, subscribe };
