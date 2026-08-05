# `useClickOutside`

An essential UI hook for detecting interactions outside a specified element (or elements) — perfect for closing modals, dropdowns, popovers, context menus, and any other dismissible UI pattern.

## Motivation (Why this hook?)

Click-outside detection sounds trivial until you actually try to build it correctly. Naive implementations re-attach listeners on every render, capture stale closures over your handler function, and break the instant you introduce a trigger button next to the element you're trying to dismiss.

`useClickOutside` is built directly on top of this library's foundational [`useEventListener`](../useEventListener/README.md) hook, which means it inherits a properly managed, single, stable event subscription on `document` rather than attaching and tearing down listeners on every re-render. Internally, the underlying hook uses React's `useEffectEvent`, so **it always calls the latest version of your callback** — you never have to worry about stale closures capturing outdated state, and you never need to memoize your handler with `useCallback` just to keep the hook happy.

The standout feature, however, is **Multi-Target Support**. Instead of only accepting a single ref, `target` can also be an *array* of refs (or elements). This is essential for any UI where more than one DOM node should be treated as "inside" the boundary — the textbook example being a dropdown panel and the toggle button that opens it. Without multi-target support, clicking the toggle button to open the dropdown would immediately be interpreted as a click outside the dropdown, closing it in the same tick it opened. By passing both refs into the array, the hook checks that the click landed outside *all* of them before firing your handler — and it's safe to include a ref that hasn't mounted yet, since an unmounted target never blocks detection for the others (see Gotchas below).

## Import

```tsx
// Preferred
import { useClickOutside } from "@himanshu-sorathiya/react-kit/events";

// OR
import { useClickOutside } from "@himanshu-sorathiya/react-kit";
```

## API Reference

### Arguments

| Argument  | Type                                                        | Required | Description                                                                                                   |
| --------- | ------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------- |
| `target`  | `ClickOutsideTargetRef \| ClickOutsideTargetRef[]`            | Yes      | A single ref/element, or an array of refs/elements, that together define the "inside" boundary.                 |
| `handler` | `(event: ClickOutsideEvent) => void`                          | Yes      | Callback invoked when a qualifying event occurs outside **all** of the given target(s). Doesn't need to be memoized. |
| `options` | `UseClickOutsideOptions`                                      | No       | Optional configuration object. See table below.                                                                 |

### `options` shape

| Option      | Type                                                | Default                          | Description                                                                                             |
| ----------- | ---------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `enabled`   | `boolean`                                            | `true`                             | Whether the outside-click detection logic is active. Setting this to `false` fully detaches the listener — it's not just a no-op check, there's zero background cost while disabled. |
| `eventType` | `ClickOutsideEventName \| ClickOutsideEventName[]`   | `["mousedown", "touchstart"]`      | The DOM event type(s) that trigger the outside-check. Restricted to `"mousedown"`, `"mouseup"`, `"click"`, `"touchstart"`, `"touchend"`, `"pointerdown"`, or `"pointerup"` — see Gotchas below for why the default isn't `"click"`. |
| `capture`   | `boolean`                                            | `true`                             | Whether the listener is invoked during the capture phase. See Gotchas below for why this defaults to `true`. |

### Return Value

The hook returns a `stop` function (`() => void`) that lets you manually detach the current listener before the component unmounts.

```tsx
const stop = useClickOutside(ref, handler);

// Later...
stop(); // Manually removes the listener
```

This detaches the *current* listener only — it's not a permanent "off" switch. If `target`, `eventType`, `enabled`, or `capture` change afterward, a new listener can be attached again on the next render.

## Advanced Usage & Examples

### Example 1: Basic Modal/Dropdown

A single ref is the most common case — toggle a boolean piece of state whenever a click lands outside the popover.

```tsx
import { useRef, useState } from "react";
import { useClickOutside } from "@himanshu-sorathiya/react-kit/events";

function Popover() {
	const [isOpen, setIsOpen] = useState(true);
	const popoverRef = useRef<HTMLDivElement>(null);

	useClickOutside(popoverRef, () => {
		setIsOpen(false);
	});

	if (!isOpen) return null;

	return <div ref={popoverRef}>Popover content</div>;
}
```

### Example 2: Multi-Target Exclusion

This is the critical pattern for any dropdown that's triggered by a separate button. Pass both refs in an array via `target: [menuRef, buttonRef]` so that clicking the toggle button doesn't instantly re-close the menu it just opened.

```tsx
import { useRef, useState } from "react";
import { useClickOutside } from "@himanshu-sorathiya/react-kit/events";

function DropdownMenu() {
	const [isOpen, setIsOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	useClickOutside([menuRef, buttonRef], () => {
		setIsOpen(false);
	});

	return (
		<>
			<button ref={buttonRef} onClick={() => setIsOpen((prev) => !prev)}>
				Toggle Menu
			</button>
			{isOpen && <div ref={menuRef}>Menu content</div>}
		</>
	);
}
```

### Example 3: Portal-Safe Detection

When part of your "inside" boundary is rendered via `createPortal` (a datepicker popover, a tooltip, a select menu rendered into `document.body`), it's a child of your component logically but not physically in the DOM. Grab a ref to the portaled content and include it in the `target` array so it's whitelisted:

```tsx
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useClickOutside } from "@himanshu-sorathiya/react-kit/events";

function DatePickerInput() {
	const [isOpen, setIsOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const portalRef = useRef<HTMLDivElement>(null);

	useClickOutside([inputRef, portalRef], () => {
		setIsOpen(false);
	});

	return (
		<>
			<input ref={inputRef} onFocus={() => setIsOpen(true)} readOnly />
			{isOpen &&
				createPortal(
					<div ref={portalRef}>Calendar popover</div>,
					document.body,
				)}
		</>
	);
}
```

## Real-World Use Cases

- Closing modals and dialog boxes when the backdrop is clicked
- Collapsing custom `<select>`-style dropdowns
- Hiding right-click or long-press context menus
- Dismissing tooltips and hover cards on outside interaction
- Auto-saving or auto-committing inline-edit text fields on blur-like outside clicks
- Deselecting canvas elements or nodes in a design/diagramming tool
- Closing mobile navigation drawers and slide-out panels
- Collapsing filter or search suggestion panels
- Commonly paired with [`useKey`](../useKey/README.md) to also close the same UI on `Escape`

## Gotchas & Edge Cases

- **The React Portal Gotcha (DOM Tree vs. React Tree):** This hook determines "outside" purely using the native DOM `.contains()` method — it has no awareness of the *React* tree, only the *DOM* tree. This distinction matters the moment you introduce a React Portal. Consider a datepicker popover rendered via `createPortal` into `document.body`. Logically, in your component tree, it's a child of your input. But physically, in the DOM, it renders at the very end of `<body>`, completely detached from its logical parent's DOM node. Since `target.contains(event.target)` checks physical DOM containment, a click inside that portaled popover will be seen as *outside* your target, incorrectly firing your close handler. **Fix:** grab a ref to the portaled content and include it in your `target` array — see Example 3 above.

- **Why `mousedown` instead of `click`?** The default `eventType` is `["mousedown", "touchstart"]` rather than `["click"]`, and this is a deliberate design choice, not an oversight. Imagine a user presses their mouse button down *inside* a modal to select some text, drags the cursor *outside* the modal's boundary while the button is still held, and then releases the mouse. A native `click` event fires wherever the mouse button was *released* — outside the modal — even though the interaction began inside it. If the hook listened for `click`, this ordinary text-selection gesture would incorrectly close your modal. By listening for `mousedown`/`touchstart` instead, the hook evaluates "outside-ness" at the moment of initial press, before any drag-selection can occur. If you override `eventType` to `['click']`, be certain you understand this tradeoff — you'll be reintroducing the accidental-closure-on-text-selection bug.

- **Why does `capture` default to `true`?** Unlike `useEventListener` (which defaults `capture` to `false`), `useClickOutside` defaults it to `true`. If a descendant element between the click and `document` calls `event.stopPropagation()` — common in rich text editors, nested interactive widgets, or third-party components — a bubble-phase listener would never see the event, and outside-click detection would silently stop working. Listening in the capture phase means this hook sees the event on the way *down* the tree, before any descendant has a chance to stop it from propagating further. You generally shouldn't need to change this, but it's exposed in case you have a specific reason to only react during the bubble phase.

- **`preventDefault()` in your handler is a silent no-op.** The underlying listener is always registered with `passive: true` (not configurable), since the hook never calls `preventDefault()` itself and passive listeners avoid blocking scroll/touch performance. `ClickOutsideEvent`'s type still exposes `.preventDefault()` (it's inherited from the underlying `MouseEvent`/`TouchEvent`/`PointerEvent`/`Event`), so TypeScript won't stop you from calling it — but the browser will silently ignore it at runtime. If you need to prevent the triggering event's default behavior, handle that separately from this hook.

- **Targets that haven't mounted yet don't block detection for the others.** If one entry in a `target` array is a ref whose `current` is still `null` — for example, an element that only renders conditionally — it's treated as if it isn't part of the boundary at all, rather than disabling outside-click detection entirely. It's safe to include refs before you know whether they'll be mounted.

- **An empty `target` array means every click counts as "outside."** Passing `target: []` (for example, from a computed/filtered array that unexpectedly ends up empty) means there's nothing to be "inside" of, so the handler fires on every click anywhere on the page. This is very likely not what you want — check for it if `target` is ever derived dynamically.

- **The `enabled` flag fully detaches, not just skips.** Setting `enabled: false` passes `null` as the target to the underlying `useEventListener`, which removes the native DOM subscription entirely rather than leaving the listener attached and short-circuiting inside the handler. You can safely mount numerous disabled click-outside listeners across your app without paying any background performance penalty until they're explicitly enabled.

- **Development-Only Warnings:** In development, the hook logs a `console.warn` once (not on every click) if `target` resolves to an empty array. This has no effect in production builds.

## See Also

- [`useEventListener`](../useEventListener/README.md) — the foundational event-subscription hook that powers `useClickOutside`.
- [`useKey`](../useKey/README.md) — commonly used alongside this hook to also dismiss the same UI on a keyboard shortcut like `Escape`.
