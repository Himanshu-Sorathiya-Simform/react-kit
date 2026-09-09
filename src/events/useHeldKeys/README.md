# `useHeldKeys`

A lightweight React hook that returns every key currently held down, updating live as keys are pressed and released.

## Motivation (Why this hook?)

`useKeyHold` answers "is *this one* key held?" — but sometimes you don't know the key ahead of time, or you want the full picture: a debug overlay showing every key currently down, a custom shortcut-capture UI in a settings page, or a combination check involving more keys than you'd want to chain as separate `useKeyHold` calls. `useHeldKeys` gives you the whole set at once.

It shares its underlying tracker with `useKeyHold` — same lazy shared listener, same physical-key tracking (so a Shift-shifted character like `+` can't get stuck if Shift is released first, and holding both Shift keys then releasing one doesn't clear Shift early), same macOS key-swallowing correction, same blur-clearing behavior — so using both together in the same app costs nothing extra beyond using one of them alone.

## Import

```tsx
// Preferred
import { useHeldKeys } from "@himanshu-sorathiya/react-kit/events";

// OR
import { useHeldKeys } from "@himanshu-sorathiya/react-kit";
```

## API Reference

### Arguments

This hook takes no arguments — it always reports every currently-held key, with nothing to configure.

### Return Value

Returns `readonly string[]` (exported as the `UseHeldKeysReturn` type) — the currently held keys, lowercased (e.g. `["shift", "a"]`), in the order they were physically pressed (the first key held is first in the array, regardless of release order in between). Always an empty array during server-side rendering.

The returned array is a **stable reference** between renders whenever the held-key set hasn't actually changed — safe to drop directly into a `useEffect`/`useMemo` dependency array without it re-running on every unrelated render.

## Advanced Usage & Examples

### Example 1: Debug Overlay

```tsx
import { useHeldKeys } from "@himanshu-sorathiya/react-kit/events";

function HeldKeysDebugOverlay() {
	const heldKeys = useHeldKeys();

	return <pre>{heldKeys.join(" + ") || "(none)"}</pre>;
}
```

### Example 2: Checking a Combination

```tsx
import { useHeldKeys } from "@himanshu-sorathiya/react-kit/events";

function SaveComboHint() {
	const heldKeys = useHeldKeys();
	const isSaveComboHeld = heldKeys.includes("s") && heldKeys.includes("meta");

	return isSaveComboHeld ? <span>Saving…</span> : null;
}
```

### Example 3: A Minimal Custom Shortcut Capture

This library doesn't ship a dedicated shortcut-recording hook, but `useHeldKeys` is enough to build a simple one directly in a settings screen:

```tsx
import { useEffect, useEffectEvent } from "react";
import { useHeldKeys } from "@himanshu-sorathiya/react-kit/events";

function ShortcutCaptureInput({ onCapture }: { onCapture: (keys: readonly string[]) => void }) {
	const heldKeys = useHeldKeys();
	const notifyCapture = useEffectEvent(onCapture);

	useEffect(() => {
		if (heldKeys.length > 0) notifyCapture(heldKeys);
	}, [heldKeys]);

	return <input readOnly value={heldKeys.join(" + ")} placeholder="Press a shortcut…" />;
}
```

`useEffectEvent` keeps the effect's dependencies limited to what should actually re-trigger it (`heldKeys`) — an unmemoized `onCapture` prop would otherwise re-run this effect on every render its parent causes, not just when the held keys change.

## Real-World Use Cases

- A keyboard-state debug panel during development
- Building a custom shortcut-capture field in a settings/preferences UI
- Combination checks across more keys than is comfortable to chain with `useKeyHold`
- Displaying "you're currently holding: …" in an accessibility or onboarding aid

## Gotchas & Edge Cases

- **Stable Array Reference Is Load-Bearing:** The returned array is cached and only replaced when the held-key set actually changes — not rebuilt on every render. This isn't just an optimization detail: a new array on every read (even one with identical contents) would either force a re-render loop or trip React's own warning that a hook's snapshot isn't stable across calls with no change in between.

- **Shares a Tracker With `useKeyHold`:** Both hooks subscribe to the same underlying listener set — mounting both in the same app doesn't attach keyboard listeners twice.

- **The macOS Meta-Key Correction Is Platform-Specific:** See the same note on `useKeyHold`'s README — this only triggers when the platform is detected as mac, to avoid misfiring on Windows/Linux.

- **Window Blur Clears Everything:** All held-key state is cleared on `blur`, on every platform, to avoid keys appearing permanently "stuck" held after an alt-tab whose `keyup` never arrives.

- **SSR Safe:** Always returns the same empty-array reference server-side.

## See Also

- [`useKeyHold`](../useKeyHold/README.md) — for watching a single known key instead of reading the full set.
- [`useKey`](../useKey/README.md) — for reacting to a key press as an event, rather than reading held state live.
