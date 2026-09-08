# `useKey`

A lightweight, fully type-safe React hook for binding keyboard shortcuts to your components — with automatic cleanup, modifier key support, input-safety guards, IME-composition safety, and key-repeat protection built in.

## Motivation (Why this hook?)

Wiring up a keyboard shortcut by hand with a raw `useEffect` looks simple at first, but it quietly accumulates edge cases: you need to remember to remove the listener on unmount, guard against stale closures capturing an old version of your handler, avoid firing the shortcut while the user is typing in a form field or composing text via an IME, and — if you want a "press-and-hold-safe" shortcut like a play/pause toggle — account for the browser firing repeated events while a key is held.

`useKey` handles all of that for you:

- **Automatic cleanup** — the listener is added and removed for you, so you never leak listeners across renders or unmounts.
- **Always-fresh handler, no stale closures** — built on top of [`useEventListener`](../useEventListener/README.md), the hook leverages React's `useEffectEvent` to always call your *latest* handler without needing to re-attach the DOM listener or list `handler` in a dependency array.
- **Modifier key support** — declaratively require `ctrlKey`, `shiftKey`, `altKey`, and/or `metaKey` to be held for the shortcut to fire, or use the platform-aware `mod` for a shortcut that should resolve to Cmd on macOS and Ctrl on Windows/Linux automatically.
- **Safe input handling** — with `ignoreWhenFocusedInInputs`, the hook automatically ignores key presses while the user is focused in an `<input>`, `<textarea>`, `<select>`, or any `contenteditable` element, so you don't accidentally hijack normal typing.
- **IME-composition safe** — ignores keystrokes fired while a user is composing text via an IME (e.g. typing pinyin or romaji before a CJK character is confirmed), so shortcuts don't misfire or interfere with the IME's own confirmation key.
- **Held-key repeat prevention** — with `preventRepeat`, the hook suppresses the flood of repeated `keydown` events fired by the browser while a key is held down, only firing your handler once per physical press.
- **Flexible targeting** — bind to `window` (the default), any DOM element, or a React `RefObject`, so shortcuts can be global or scoped to a specific component.

The result: declarative, predictable keyboard shortcuts with a single hook call, instead of hand-rolled `useEffect` boilerplate scattered across your codebase.

## Import

```tsx
// Preferred
import { useKey } from "@himanshu-sorathiya/react-kit/events";

// OR
import { useKey } from "@himanshu-sorathiya/react-kit";
```

## API Reference

### Arguments

| Argument  | Type                          | Required | Description                                                                                                   |
| --------- | ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------- |
| `key`     | `string`                       | Yes      | The key to listen for, matched against `KeyboardEvent.key`. **Case-insensitive** — `"Escape"`, `"escape"`, and `"ESCAPE"` are all treated the same. |
| `handler` | `(event: KeyboardEvent) => void` | Yes    | Callback invoked when the key (and any required modifiers) match. Doesn't need to be memoized — the latest `handler` is always used, and changing it does not re-attach the listener. |
| `options` | `UseKeyOptions`                 | No     | Configuration object described below.                                                                          |

### `options` shape

| Property                    | Type                                                          | Default     | Description                                                                                     |
| ---------------------------- | -------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `enabled`                    | `boolean`                                                      | `true`      | Toggle the shortcut on or off. When `false`, the underlying listener is fully detached from the DOM rather than left attached and short-circuited — zero background cost while disabled. |
| `preventDefault`             | `boolean`                                                      | `true`      | Calls `event.preventDefault()` when the handler fires, applied before `handler` is called. |
| `stopPropagation`            | `boolean`                                                      | `true`      | Calls `event.stopPropagation()` when the handler fires, applied before `handler` is called. |
| `capture`                    | `boolean`                                                      | `false`     | Whether the listener is invoked during the capture phase. See Gotchas below for when you'd want to change this. |
| `eventType`                  | `"keydown" \| "keyup" \| "keypress"`                            | `"keydown"` | Which keyboard event to listen for.                                                              |
| `preventRepeat`              | `boolean`                                                      | `false`     | Suppresses the handler from firing repeatedly while the key is held down, based on the native `KeyboardEvent.repeat` property. Not valid with `eventType: "keyup"` — enforced at the type level, since keyup events are never marked as repeating. |
| `ignoreWhenFocusedInInputs`  | `boolean`                                                      | `true`      | Skips the handler when the event target is an `<input>`, `<textarea>`, `<select>`, or a `contenteditable` element. |
| `mod`                        | `boolean`                                                      | `false`     | Whether the platform's primary modifier must be held — Meta (Cmd) on macOS, Ctrl on Windows/Linux — auto-detected. Cannot be combined with `ctrlKey`/`metaKey` — see note below. |
| `ctrlKey`                    | `boolean`                                                      | `false`     | Whether the Ctrl key must be held for the shortcut to match. Cannot be combined with `mod` — see note below. |
| `shiftKey`                   | `boolean`                                                      | `false`     | Whether the Shift key must be held for the shortcut to match.                                    |
| `altKey`                     | `boolean`                                                      | `false`     | Whether the Alt (or Option) key must be held for the shortcut to match.                          |
| `metaKey`                    | `boolean`                                                      | `false`     | Whether the Meta key (Cmd on macOS, Windows key on Windows) must be held for the shortcut to match. Cannot be combined with `mod` — see note below. |
| `target`                     | `Window \| Document \| HTMLElement \| RefObject<HTMLElement \| null> \| null` | `window` | The element the listener is attached to. A React `RefObject` is strongly preferred for scoping a shortcut to a specific component; `window`, `document`, or a plain element also work. |

> **Note on modifiers:** matching is exact against `ctrlKey`, `shiftKey`, `altKey`, and `metaKey` all at once — if you don't set `ctrlKey: true`, the shortcut will *not* fire while Ctrl is held, even if the base key matches.
>
> `mod` resolves to `ctrlKey`/`metaKey` internally (Meta on macOS, Ctrl on Windows/Linux) before this matching happens, so `{ mod: true }` is still an exact match against whichever one it resolves to, not an "either modifier" check. Because of that, `mod` and an explicit `ctrlKey`/`metaKey` are mutually exclusive: TypeScript rejects passing both, and if a plain-JS caller does anyway, `mod` takes precedence and a `console.warn` is logged in development.

### Return Value

The hook returns a `stop` function (`() => void`) that lets you manually detach the current listener before the component unmounts.

```tsx
const stop = useKey("Escape", handler);

// Later...
stop(); // Manually removes the listener
```

This detaches the *current* listener only — it's not a permanent "off" switch. If `eventType`, `enabled`, `target`, or `capture` change afterward, a new listener can be attached again on the next render. Changing `key` or any modifier flag does *not* cause a re-attach — those are picked up fresh on the next keystroke without the listener ever being torn down.

## Advanced Usage & Examples

### Example 1: Basic Escape-to-Close

The most common case — closing a modal or dropdown when the user presses `Escape`.

```tsx
import { useKey } from "@himanshu-sorathiya/react-kit/events";

function Modal({ onClose }: { onClose: () => void }) {
	useKey("Escape", onClose);

	return <div role="dialog">Modal content</div>;
}
```

### Example 2: Cross-Platform Modifier Shortcut (Command Palette)

Use `mod` for a shortcut that should follow platform convention — it resolves to Meta (Cmd) on macOS and Ctrl on Windows/Linux automatically:

```tsx
import { useKey } from "@himanshu-sorathiya/react-kit/events";

function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
	useKey("k", onOpen, { mod: true });

	return null;
}
```

### Example 3: Preventing Key Repeat (Play/Pause Media)

Toggle playback with the spacebar, without the handler firing dozens of times while the key is held:

```tsx
import { useKey } from "@himanshu-sorathiya/react-kit/events";

function VideoPlayer({ onTogglePlay }: { onTogglePlay: () => void }) {
	useKey(" ", onTogglePlay, { preventRepeat: true });

	return <video />;
}
```

### Example 4: Scoping to a Specific Target

Bind a hotkey so it only fires when a specific element — like a canvas or custom editor — is focused, by passing a `RefObject` as `target`:

```tsx
import { useRef } from "react";
import { useKey } from "@himanshu-sorathiya/react-kit/events";

function CanvasEditor({ onDelete }: { onDelete: () => void }) {
	const canvasRef = useRef<HTMLDivElement>(null);

	useKey("Delete", onDelete, { target: canvasRef });

	return <div ref={canvasRef} tabIndex={0} />;
}
```

### Example 5: Form/Input Safety

By default, `ignoreWhenFocusedInInputs` prevents the handler from firing while the user is typing in an `<input>`, `<textarea>`, or `contenteditable` element — so a global shortcut like `"s"` for "save" won't hijack normal typing:

```tsx
import { useKey } from "@himanshu-sorathiya/react-kit/events";

function SaveShortcut({ onSave }: { onSave: () => void }) {
	// Won't fire while typing in a text field, by default
	useKey("s", onSave, { mod: true });

	return <input type="text" />;
}
```

Set `ignoreWhenFocusedInInputs: false` if you deliberately want the shortcut to work even while an input is focused.

## Real-World Use Cases

- Closing modals, dropdowns, or popovers on `Escape`
- Navigating an image carousel with the arrow keys
- Triggering a global search or command palette with `Ctrl`/`Cmd + K`
- Play/pause toggling for video or audio players with the spacebar
- Muting or unmuting audio with a dedicated hotkey
- Navigating up and down a list or menu with arrow keys
- Triggering a manual save with `Ctrl`/`Cmd + S`
- Undo/redo actions with `Ctrl`/`Cmd + Z` and `Ctrl`/`Cmd + Shift + Z`
- Commonly paired with [`useClickOutside`](../useClickOutside/README.md) to dismiss the same UI on both `Escape` and an outside click

## Gotchas & Edge Cases

- **SSR Safe:** On the server, `window` is `undefined`, so the resolved target safely falls back to `null` and the DOM-binding logic is skipped entirely. `mod` is also SSR-safe — with no `navigator` to read, it resolves to Ctrl (the non-macOS branch) — though this has no practical effect, since the listener itself doesn't attach until the client anyway. No errors are thrown during server-side rendering or static generation.

- **IME Composition Safety:** Keystrokes fired while a user is composing text via an IME — for example, typing pinyin or romaji before a CJK character is confirmed — are ignored entirely, before any key or modifier matching happens. Without this, a shortcut bound to a common confirmation key like `Enter` could misfire mid-composition or interfere with the IME's own confirmation step, making the affected component unusable for Chinese, Japanese, or Korean input. This is automatic and not configurable.

- **`preventDefault`/`stopPropagation` Run Before Your Handler:** Both are applied before `handler` is called, not after, so the behavior you configured still takes effect even if `handler` throws an error.

- **Why does `capture` default to `false` here (unlike `useClickOutside`)?** If a descendant element calls `event.stopPropagation()` on a keydown/keyup event, a bubble-phase listener like this one's default won't see it, and the shortcut will silently stop firing. This is less commonly an issue for keyboard shortcuts than for click-outside detection, so the default favors the more familiar bubble-phase behavior — but if you have a global hotkey that mysteriously stops working near a specific component, try `capture: true`.

- **Repeat Detection Relies on the Native `KeyboardEvent.repeat` Flag:** `preventRepeat` doesn't track key state manually — it reads the browser's own repeat flag, which is simpler and accurate for the single-key/combo shortcuts this hook targets. One known limitation: there's a narrow, currently unfixed Chromium bug where holding several *different* keys simultaneously and releasing one can cause `.repeat` to misreport for the others still held. This doesn't affect the common case of a single key or modifier combo held on its own.

- **`keypress` Is Deprecated:** The `keypress` event is deprecated in modern browsers and has inconsistent behavior for non-printable keys. It's still supported here for backwards compatibility, but prefer `eventType: "keydown"` for new code. If you were relying on `keypress`'s non-repeating behavior for a single press, replicate it with:

```tsx
useKey("Enter", handleSubmit, { eventType: "keydown", preventRepeat: true });
```

- **Development-Only Warnings:** In development, the hook logs a `console.warn` if `key` resolves to an empty string, since such a listener can never match anything, and separately if `mod` is combined with an explicit `ctrlKey`/`metaKey` — a combination TypeScript already rejects, but worth flagging at runtime for callers not using it. Neither warning has any effect in production builds.

## See Also

- [`useEventListener`](../useEventListener/README.md) — the foundational event-subscription hook that powers `useKey`.
- [`useClickOutside`](../useClickOutside/README.md) — commonly used alongside this hook to dismiss the same UI on both a keyboard shortcut and an outside click.
