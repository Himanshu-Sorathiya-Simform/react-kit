# `useClickOutside`

An essential UI hook for detecting interactions outside a specified element (or elements) — perfect for closing modals, dropdowns, popovers, context menus, and any other dismissible UI pattern.

## Motivation (Why this hook?)

Click-outside detection sounds trivial until you actually try to build it correctly. Naive implementations re-attach listeners on every render, capture stale closures over your handler function, and break the instant you introduce a trigger button next to the element you're trying to dismiss.

`useClickOutside` is built directly on top of this library's foundational [`useEventListener`](../useEventListener/README.md) hook, which means it inherits a properly managed, single, stable event subscription on `document` rather than attaching and tearing down listeners on every re-render. Internally, the hook stashes your `handler` in a `ref` and updates it via `useIsomorphicLayoutEffect`, so **it always calls the latest version of your callback** — you never have to worry about stale closures capturing outdated state, and you never need to memoize your handler with `useCallback` just to keep the hook happy.

The standout feature, however, is **Multi-Target Support**. Instead of only accepting a single ref, `target` can also be an *array* of refs (or elements). This is essential for any UI where more than one DOM node should be treated as "inside" the boundary — the textbook example being a dropdown panel and the toggle button that opens it. Without multi-target support, clicking the toggle button to open the dropdown would immediately be interpreted as a click outside the dropdown, closing it in the same tick it opened. By passing both refs into the array, the hook checks that the click landed outside *all* of them before firing your handler.

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
| `handler` | `(event: ClickOutsideEvent) => void`                          | Yes      | Callback invoked when a qualifying event occurs outside **all** of the given target(s).                        |
| `options` | `UseClickOutsideOptions`                                      | No       | Optional configuration object. See table below.                                                                 |

### Options

| Option      | Type                    | Default                          | Description                                                                                             |
| ----------- | ----------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `enabled`   | `boolean`                | `true`                             | Whether the outside-click detection logic is active.                                                    |
| `eventType` | `string \| string[]`     | `["mousedown", "touchstart"]`      | The DOM event type(s) that trigger the outside-check.                                                   |

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

## Real-World Use Cases

- Closing modals and dialog boxes when the backdrop is clicked
- Collapsing custom `<select>`-style dropdowns
- Hiding right-click or long-press context menus
- Dismissing tooltips and hover cards on outside interaction
- Auto-saving or auto-committing inline-edit text fields on blur-like outside clicks
- Deselecting canvas elements or nodes in a design/diagramming tool
- Closing mobile navigation drawers and slide-out panels
- Collapsing filter or search suggestion panels

## Gotchas & Edge Cases

### The React Portal Gotcha (DOM Tree vs. React Tree)

This hook determines "outside" purely using the native DOM `.contains()` method — it has no awareness of the *React* tree, only the *DOM* tree. This distinction matters the moment you introduce a React Portal.

Consider a datepicker popover rendered via `createPortal` into `document.body`. Logically, in your component tree, it's a child of your input. But physically, in the DOM, it renders at the very end of `<body>`, completely detached from its logical parent's DOM node. Since `target.contains(event.target)` checks physical DOM containment, a click inside that portaled popover will be seen as *outside* your target, incorrectly firing your close handler.

**Fix:** Grab a ref to the portaled content and include it in your `target` array to whitelist it, e.g. `target: [inputRef, portalRef]`.

### Why `mousedown` instead of `click`?

The default `eventType` is `["mousedown", "touchstart"]` rather than `["click"]`, and this is a deliberate design choice, not an oversight.

Imagine a user presses their mouse button down *inside* a modal to select some text, drags the cursor *outside* the modal's boundary while the button is still held, and then releases the mouse. A native `click` event fires wherever the mouse button was *released* — outside the modal — even though the interaction began inside it. If the hook listened for `click`, this ordinary text-selection gesture would incorrectly close your modal.

By listening for `mousedown`/`touchstart` instead, the hook evaluates "outside-ness" at the moment of initial press, before any drag-selection can occur. If you override `eventType` to `['click']`, be certain you understand this tradeoff — you'll be reintroducing the accidental-closure-on-text-selection bug.

### The `enabled` Flag Mechanics

It's important to understand that `enabled: false` does **not** detach the underlying event listener from `document`. The listener registered via `useEventListener` remains attached for the lifetime of the component regardless of `enabled`'s value.

Instead, `enabled` acts as a simple short-circuit — an early `return` — at the very top of the internal event handler. Every qualifying event still reaches the handler function; it's just silently ignored when `enabled` is `false`. The performance overhead of this is negligible, but it's a meaningful architectural detail: if you're debugging why a listener still appears to be registered in your DevTools' event listener panel while the hook is "disabled," this is why — the subscription itself doesn't go away, only its effect does.

## See Also

- [`useEventListener`](../useEventListener/README.md) — the foundational event-subscription hook that powers `useClickOutside`.
