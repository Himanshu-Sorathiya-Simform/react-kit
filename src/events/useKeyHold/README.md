# `useKeyHold`

A lightweight React hook that reports whether a given key is currently held down, updating live as it's pressed and released.

## Motivation (Why this hook?)

`useKey` is imperative — "when this happens, run that" — which covers most shortcut needs, but it structurally can't answer a different, equally common question: "is Shift held down *right now*?" That's not an event to react to, it's a live piece of render state — the kind of thing you'd want for showing a different icon while a modifier is held, panning a canvas only while Space is down, or gating a multi-select interaction on Ctrl/Cmd being pressed.

`useKeyHold` answers exactly that, and does it efficiently:

- **One shared listener, not one per call** — every `useKeyHold` (and `useHeldKeys`) call in the app reads from the same underlying tracker, which attaches its `window` listeners lazily on the first subscriber and tears them down once the last one unmounts. Calling this hook ten times across ten components costs one listener set, not ten.
- **Never confuses a modifier-shifted key for a different one** — the tracker follows the *physical* key (`KeyboardEvent.code`), not just the character it produced. Without that, holding Shift, pressing `=` (reported as `+`), and releasing Shift *before* `=` would leave `+` stuck "held" forever — the matching `keyup` for `=` reports `key: "="`, which nothing recognizes as releasing the `+` that's actually down.
- **Correct on macOS's key-swallowing quirk** — macOS never fires a `keyup` for a non-modifier key released while Cmd is still held; the browser only learns about it once Cmd itself is released. The tracker detects and corrects for this on mac specifically, so a key doesn't appear artificially "stuck" held.
- **Never gets stuck on a lost `keyup`** — if the window loses focus (alt-tabbing away, a devtools panel stealing focus) while a key is held, there's no guarantee its `keyup` ever arrives. The tracker clears all held-key state on `blur`, so nothing reports as permanently held after refocusing.
- **SSR safe** — always reports `false` on the server, since there's no keyboard to read.

## Import

```tsx
// Preferred
import { useKeyHold } from "@himanshu-sorathiya/react-kit/events";

// OR
import { useKeyHold } from "@himanshu-sorathiya/react-kit";
```

## API Reference

### Arguments

| Argument | Type     | Required | Description                                                                                        |
| -------- | -------- | -------- | --------------------------------------------------------------------------------------------------- |
| `key`    | `string` | Yes      | The key to watch, matched against `KeyboardEvent.key`. **Case-insensitive** — `"Shift"`, `"shift"`, and `"SHIFT"` are all treated the same. The spacebar can be passed either as `" "` (its real `KeyboardEvent.key` value) or the word `"Space"` — both resolve identically. |

This hook takes no options object — there's nothing to configure beyond which key to watch, since it has no default-preventing, no target, and no repeat behavior to speak of.

### Return Value

Returns a `boolean` (exported as the `UseKeyHoldReturn` type) — `true` while `key` is held down, `false` otherwise (including for the entire duration of server-side rendering).

## Advanced Usage & Examples

### Example 1: Basic Held Indicator

```tsx
import { useKeyHold } from "@himanshu-sorathiya/react-kit/events";

function ShiftIndicator() {
	const isShiftHeld = useKeyHold("Shift");

	return <span>{isShiftHeld ? "Shift is held" : "Shift is not held"}</span>;
}
```

### Example 2: Hold-to-Pan a Canvas

```tsx
import { useKeyHold } from "@himanshu-sorathiya/react-kit/events";

function CanvasEditor() {
	const isPanning = useKeyHold(" ");

	return <div style={{ cursor: isPanning ? "grab" : "default" }} />;
}
```

### Example 3: Checking a Modifier Combination

Two calls, ORed together — `useKeyHold` deliberately watches one key each, so a combination is composed at the call site rather than the hook needing to understand combos itself. Call both unconditionally and combine the *results*, not the calls — `isControlHeld || useKeyHold("Meta")` would short-circuit and skip the second hook call on some renders but not others, which breaks React's Rules of Hooks:

```tsx
import { useKeyHold } from "@himanshu-sorathiya/react-kit/events";

function MultiSelectHint() {
	const isControlHeld = useKeyHold("Control");
	const isMetaHeld = useKeyHold("Meta");
	const isMultiSelectHeld = isControlHeld || isMetaHeld;

	return isMultiSelectHeld ? <span>Click to add to selection</span> : null;
}
```

## Real-World Use Cases

- Showing a "hold Space to pan" cursor change in a canvas or map editor
- Gating multi-select behavior on Ctrl/Cmd being held while clicking
- Live-updating a keyboard shortcut hint (e.g. dimming an icon only while its modifier is actually pressed)
- Push-to-talk style interactions, holding a key to record or transmit
- Showing alternate button labels while Alt/Option is held, mirroring native OS context menus

## Gotchas & Edge Cases

- **Shared Tracker, Not a Private Listener:** Unlike `useKey`, this hook doesn't attach its own `window` listener — it subscribes to one shared tracker used by every `useKeyHold`/`useHeldKeys` call in the app. Mounting many of these simultaneously doesn't multiply listener count.

- **The macOS Meta-Key Correction Is Platform-Specific:** The "held keys clear when Meta's keyup fires" correction only applies when the current platform is detected as mac. Applying it universally would misfire on Windows/Linux, where a non-modifier key still marked held after Meta's `keyup` genuinely might still be physically held — those platforms don't swallow that `keyup` the way macOS does.

- **Window Blur Clears Everything:** Losing window focus clears all tracked held-key state, on every platform, not just mac. This is a deliberate trade-off: without it, a key held during an alt-tab could appear permanently "stuck" held after refocusing, since its `keyup` may never arrive.

- **IME Composition Doesn't Affect This Hook:** `useKey` ignores keystrokes during IME composition because a misfired *callback* is disruptive. `useKeyHold` has no callback to misfire — just a boolean someone reads — and composition doesn't typically involve holding modifier keys, which is the primary use case here.

- **SSR Safe:** Always returns `false` server-side, since `window` doesn't exist to read keyboard state from.

- **Development-Only Warnings:** In development, the hook logs a `console.warn` if `key` resolves to an empty string, since such a call can never report as held. Has no effect in production builds.

## See Also

- [`useHeldKeys`](../useHeldKeys/README.md) — the array counterpart, for reading every currently-held key at once instead of watching one at a time.
- [`useKey`](../useKey/README.md) — for reacting to a key press as an event, rather than reading its held state live.
