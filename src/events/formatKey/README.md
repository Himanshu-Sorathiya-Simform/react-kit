# `formatKey`

A small, platform-aware function that formats a key combination into a human-readable display string — the same modifier shape `useKey` matches against, turned into text or symbols for showing in a UI.

## Motivation (Why this function?)

Once a shortcut is wired up with `useKey`, there's usually a second, separate problem: showing the user what it is. "Cmd+S" on mac and "Ctrl+S" on Windows aren't the same string, modifier symbols (⌘⌥⇧⌃) only exist on mac, and keys like Enter or the arrows read better as glyphs (↵ ↑ ↓ ← →) than as their raw event names. Hand-rolling this platform branching in every tooltip, menu, or settings page is exactly the kind of thing that's easy to get subtly wrong in one spot and never notice.

`formatKey` centralizes it:

- **Platform-aware by default** — auto-detects mac/Windows/Linux and resolves `mod` and modifier symbols accordingly, the same detection `useKey`'s own `mod` option uses.
- **Compatible modifier shape** — the modifier fields (`mod`, `ctrlKey`, `shiftKey`, `altKey`, `metaKey`) match those accepted by `useKey`'s options, so a shared descriptor object can define both the binding and the display label — see [Example 3](#example-3-reusing-the-same-options-object-passed-to-usekey) for the one field (`key`) you still extract separately.
- **Symbols or text labels, your choice** — `⌘ ⇧ S` or `Cmd+Shift+S`, controlled by one option.
- **Case-insensitive**, matching `useKey`'s own tolerance for `key`.

## Import

```tsx
import { formatKey } from "@himanshu-sorathiya/react-kit/events";
```

This isn't a hook — it's a plain function, safe to call anywhere, including outside components.

## API Reference

### Arguments

| Argument     | Type                  | Required | Description                                          |
| ------------- | ---------------------- | -------- | ------------------------------------------------------ |
| `descriptor`  | `FormatKeyDescriptor`  | Yes      | The key combination to format, described below.        |
| `options`     | `FormatKeyOptions`     | No       | Formatting configuration, described below.              |

### `descriptor` shape

| Property   | Type      | Default | Description                                                                                     |
| ----------- | --------- | ------- | --------------------------------------------------------------------------------------------------- |
| `key`       | `string`  | —       | Required. The key to format, e.g. `"s"`, `"Escape"`, `"ArrowUp"`, `","`. Case-insensitive.       |
| `mod`       | `boolean` | `false` | Formats as the platform's primary modifier — Meta (Cmd) on mac, Ctrl on Windows/Linux. Mutually exclusive with `ctrlKey`/`metaKey`, same as `useKey`'s `mod`. |
| `ctrlKey`   | `boolean` | `false` | Whether Ctrl is part of the combination. Mutually exclusive with `mod`.                           |
| `metaKey`   | `boolean` | `false` | Whether Meta (Cmd/Windows key) is part of the combination. Mutually exclusive with `mod`.          |
| `shiftKey`  | `boolean` | `false` | Whether Shift is part of the combination.                                                        |
| `altKey`    | `boolean` | `false` | Whether Alt (Option, on mac) is part of the combination.                                          |

### `options` shape

| Property     | Type                              | Default             | Description                                                                                                 |
| ------------- | ----------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `platform`    | `"mac" \| "windows" \| "linux"`     | auto-detected        | Overrides platform detection — useful for rendering a shortcut for a platform other than the one currently running, e.g. a docs page listing both mac and Windows bindings side by side. |
| `useSymbols`  | `boolean`                          | `true`               | Renders glyphs where available (modifier symbols on mac only; special-key symbols like ↵ ⌫ ⇥ ↑ ↓ ← → on any platform) instead of text labels. |

### Return Value

Returns a `string` — the formatted display text, e.g. `"⌘ S"` or `"Ctrl+S"`.

## Advanced Usage & Examples

### Example 1: A Cross-Platform Shortcut Hint

```tsx
import { formatKey } from "@himanshu-sorathiya/react-kit/events";

function SaveButton() {
	return <button title={formatKey({ key: "s", mod: true })}>Save</button>;
	// "⌘ S" on mac, "Ctrl+S" on Windows/Linux
}
```

### Example 2: Text Labels Instead of Symbols

```tsx
formatKey({ key: "s", mod: true }, { useSymbols: false });
// "Cmd+S" on mac, "Ctrl+S" on Windows/Linux
```

### Example 3: Reusing the Same Options Object Passed to `useKey`

Since both share the same modifier shape, the object registering a shortcut can double as the object displaying it:

```tsx
import { useKey, formatKey } from "@himanshu-sorathiya/react-kit/events";

const saveShortcut = { key: "s", mod: true };

function SaveButton({ onSave }: { onSave: () => void }) {
	useKey(saveShortcut.key, onSave, { mod: saveShortcut.mod });

	return <button title={formatKey(saveShortcut)}>Save</button>;
}
```

### Example 4: Forcing a Specific Platform's Display

For a docs page or settings screen that lists shortcuts for a platform other than the one it's currently viewed on:

```tsx
formatKey({ key: "s", mod: true }, { platform: "mac" });
// "⌘ S" — regardless of what OS this code is actually running on
```

### Example 5: Special Keys and Punctuation

```tsx
formatKey({ key: "ArrowUp" });   // "↑"
formatKey({ key: "Enter" });     // "↵"
formatKey({ key: "," });         // "Comma"
```

## Real-World Use Cases

- Shortcut hints in `title`/tooltip attributes on buttons and menu items
- A keyboard-shortcuts settings or reference page
- Command palette entries showing each command's bound shortcut
- Onboarding tooltips that reveal a shortcut the first time a feature is used
- Documentation or marketing pages listing both mac and Windows bindings side by side

## Gotchas & Edge Cases

- **Modifier Symbols Are Mac-Only:** ⌘⌥⇧⌃ only exist as a platform convention on mac — Ctrl/Alt/Shift/Win have no equivalent iconography on Windows or Linux, so those always render as text there regardless of `useSymbols`. `useSymbols` still affects non-modifier keys (arrows, Enter, Tab, etc.) on every platform.

- **Separator Differs by Mode:** mac in symbol mode joins parts with a space (`"⌘ ⇧ Z"`), matching how macOS itself displays combinations — every other case, including mac with `useSymbols: false`, joins with `"+"` (`"Cmd+Shift+Z"`, `"Ctrl+Shift+Z"`). Don't assume a fixed separator when comparing formatted strings across platforms or modes.

- **SSR / Hydration Mismatch Risk:** With no `platform` passed explicitly, this calls `detectPlatform()`, which has no `navigator` to read during server-side rendering and falls back to `"windows"`. If a client actually running on mac renders the same call without an explicit `platform`, the server-rendered text (`"Ctrl+S"`) won't match what the client recomputes (`"⌘ S"`), producing a React hydration mismatch. If you render this directly in server-rendered markup, either pass `platform` explicitly from something known server-side, or defer rendering the formatted text until after mount.

- **Unmapped Multi-Character Keys Get Their First Letter Capitalized:** Single-character keys are always uppercased (`"s"` → `"S"`), and keys covered by the built-in maps (arrows, Enter, Escape, punctuation, etc.) are resolved case-insensitively. A multi-character key with no map entry — an uncommon or custom key name like `"F13"` or a browser-specific value — only has its first letter capitalized (`"capslock"` → `"Capslock"`); it isn't title-cased or otherwise reformatted, so a real `KeyboardEvent.key` value (already correctly cased per spec, e.g. `"ContextMenu"`) passes through unchanged.

- **The Spacebar Works Either Way:** `KeyboardEvent.key` reports the spacebar as a literal `" "`, not the word `"Space"` — `formatKey({ key: " " })` and `formatKey({ key: "Space" })` both resolve to the same label (`"␣"` or `"Space"`, depending on `useSymbols`). `useKey`/`useKeyHold` accept both forms too, for the same reason.

- **Pure Function, No React Dependency:** Safe to call in a test, in Storybook, in a Node script generating documentation, or anywhere else outside a component tree — it doesn't touch React at all.

## See Also

- [`useKey`](../useKey/README.md) — shares the same modifier shape and `mod` semantics this function formats.
