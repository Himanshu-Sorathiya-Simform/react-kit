# `useKey`

A lightweight, fully type-safe React hook for binding keyboard shortcuts to your components — with automatic cleanup, modifier key support, input-safety guards, and key-repeat protection built in.

---

## Motivation (Why this hook?)

Wiring up a keyboard shortcut by hand with a raw `useEffect` looks simple at first, but it quietly accumulates edge cases: you need to remember to remove the listener on unmount, guard against stale closures capturing an old version of your handler, avoid firing the shortcut while the user is typing in a form field, and — if you want a "press-and-hold-safe" shortcut like a play/pause toggle — manually track whether the key is already down.

`useKey` handles all of that for you:

- **Automatic cleanup** — the listener is added and removed for you inside a single `useEffect`, so you never leak listeners across renders or unmounts.
- **Always-fresh handler, no stale closures** — your `handler` is stored in a `ref` and synced via `useLayoutEffect` on every render, so the hook always calls your *latest* handler without needing to re-attach the DOM listener or list `handler` in a dependency array.
- **Modifier key support** — declaratively require `ctrlKey`, `shiftKey`, `altKey`, and/or `metaKey` to be held (or *not* held) for the shortcut to fire.
- **Safe input handling** — with `ignoreWhenFocusedInInputs`, the hook automatically ignores key presses while the user is focused in an `<input>`, `<textarea>`, `<select>`, or any `contenteditable` element, so you don't accidentally hijack normal typing.
- **Held-key repeat prevention** — with `preventRepeat`, the hook suppresses the flood of repeated `keydown` events fired by the browser while a key is held down, only firing your handler once per physical press.
- **Flexible targeting** — bind to `window` (the default), any DOM element, or a React `RefObject`, so shortcuts can be global or scoped to a specific component.

The result: declarative, predictable keyboard shortcuts with a single hook call, instead of hand-rolled `useEffect` boilerplate scattered across your codebase.

---

## Import Syntax

```tsx
// Preferred
import { useKey, type UseKeyReturn, type KeyOptions } from "@himanshu-sorathiya/react-kit/events";
// Or
import { useKey, type UseKeyReturn, type KeyOptions } from "@himanshu-sorathiya/react-kit";
```

---

## Basic Usage

A minimal example: closing a modal or dropdown when the user presses `Escape`.

```tsx
import { useKey } from "@himanshu-sorathiya/react-kit/events";

function Modal({ onClose }: { onClose: () => void }) {
	useKey("Escape", onClose);

	return <div role="dialog">{/* modal content */}</div>;
}
```

That's it — no manual `useEffect`, no manual cleanup, no stale closure concerns.

---

## API Reference

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | `string` | Yes | The key to listen for, matched against `KeyboardEvent.key`. **Case-insensitive** — `"Escape"`, `"escape"`, and `"ESCAPE"` are all treated the same. |
| `handler` | `(e: KeyboardEvent) => void` | Yes | Callback invoked when the key (and any required modifiers) match. Always receives the live `KeyboardEvent`. Safe to pass an inline arrow function — it's stored in a ref internally, so it won't cause the listener to be re-attached on every render. |
| `options` | `KeyOptions` | No | Configuration object described below. |

### `KeyOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Toggle the shortcut on or off without unmounting the hook. When `false`, the listener stays attached but the handler is skipped. |
| `preventDefault` | `boolean` | `true` | Calls `e.preventDefault()` when the handler fires. |
| `stopPropagation` | `boolean` | `true` | Calls `e.stopPropagation()` when the handler fires. |
| `eventType` | `"keydown" \| "keyup" \| "keypress"` | `"keydown"` | Which keyboard event to listen for. |
| `preventRepeat` | `boolean` | `false` | Suppresses the handler from firing repeatedly while the key is held down. **Not available when `eventType` is `"keyup"`** — enforced at the type level. |
| `ignoreWhenFocusedInInputs` | `boolean` | `true` | Skips the handler when the event target is an `<input>`, `<textarea>`, `<select>`, or a `contenteditable` element. |
| `ctrlKey` | `boolean` | `false` | Whether the Ctrl key must be held for the shortcut to match. |
| `shiftKey` | `boolean` | `false` | Whether the Shift key must be held for the shortcut to match. |
| `altKey` | `boolean` | `false` | Whether the Alt (or Option) key must be held for the shortcut to match. |
| `metaKey` | `boolean` | `false` | Whether the Meta key (Cmd on macOS, Windows key on Windows) must be held for the shortcut to match. |
| `target` | `Window \| HTMLElement \| RefObject<HTMLElement>` | `window` | The element the listener is attached to. **A React `RefObject` is strongly preferred** for scoping a shortcut to a specific component; a plain DOM element (including `window`) also works. |

> **Note on modifiers:** modifier matching is exact. If you don't set `ctrlKey: true`, the shortcut will *not* fire while Ctrl is held — even if the base key matches. Set every modifier your shortcut actually requires.

---

## Advanced Usage & Examples

### Modifier Key Combo (Command Palette)

Open a global command palette with `Ctrl + K` (or `Cmd + K` on macOS via `metaKey`):

```tsx
import { useKey } from "@himanshu-sorathiya/react-kit/events";

function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
	useKey("k", onOpen, { ctrlKey: true, metaKey: true });

	return null;
}
```

> Since modifier matching is exact, combining `ctrlKey: true` and `metaKey: true` requires *both* to be pressed simultaneously. If you want the shortcut to work with *either* Ctrl (Windows/Linux) or Cmd (macOS), use two separate `useKey` calls instead — one per modifier.

### Preventing Key Repeat (Play/Pause Media)

Toggle playback with the spacebar, without the handler firing dozens of times while the key is held:

```tsx
import { useKey } from "@himanshu-sorathiya/react-kit/events";

function VideoPlayer({ onTogglePlay }: { onTogglePlay: () => void }) {
	useKey(" ", onTogglePlay, { preventRepeat: true });

	return <video />;
}
```

### Scoping to a Specific Target

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

### Form/Input Safety

By default, `ignoreWhenFocusedInInputs` prevents the handler from firing while the user is typing in an `<input>`, `<textarea>`, or `contenteditable` element — so a global shortcut like `"s"` for "save" won't hijack normal typing:

```tsx
import { useKey } from "@himanshu-sorathiya/react-kit/events";

function SaveShortcut({ onSave }: { onSave: () => void }) {
	// Won't fire while typing in a text field, by default
	useKey("s", onSave, { ctrlKey: true });

	return <input type="text" />;
}
```

Set `ignoreWhenFocusedInInputs: false` if you deliberately want the shortcut to work even while an input is focused.

---

## Real-World Use Cases

- Closing modals, dropdowns, or popovers on `Escape`
- Navigating an image carousel with the arrow keys
- Triggering a global search or command palette with `Ctrl/Cmd + K`
- Play/pause toggling for video or audio players with the spacebar
- Muting or unmuting audio with a dedicated hotkey
- Navigating up and down a list or menu with arrow keys
- Triggering a manual save with `Ctrl/Cmd + S`
- Undo/redo actions with `Ctrl/Cmd + Z` and `Ctrl/Cmd + Shift + Z`

---

## Gotchas & Edge Cases

- **SSR Warning.** This library is **strictly client-side**. The `target` option defaults to `window`, and since `window` does not exist during server-side rendering, using `useKey` in an SSR context (Next.js, Remix, etc.) without guarding for the client will throw:

```
ReferenceError: window is not defined
```

Make sure any component using `useKey` only renders on the client — for example, by rendering it inside a client-only boundary, or ensuring the component itself is marked as client-only in frameworks that distinguish server and client components.

- **`keypress` Is Deprecated.** The `keypress` event is deprecated in modern browsers and should be avoided. Use `eventType: "keydown"` instead. If you were relying on `keypress`'s non-repeating behavior for a single key press, replicate it with:

```tsx
useKey("Enter", handleSubmit, { eventType: "keydown", preventRepeat: true });
```

---
