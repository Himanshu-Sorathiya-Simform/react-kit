# `useEventListener`

A heavily typed, SSR-safe, and highly optimized event binding hook for attaching DOM event listeners to `Window`, `Document`, `HTMLElement`, `SVGElement`, or any custom event-emitting target — without stale closures, without unnecessary re-binding, and without giving up an inch of type safety.

## Motivation (Why this hook?)

Manually wiring up `addEventListener` inside a raw `useEffect` is one of those things that *looks* simple until you hit the edge cases: handlers that close over stale state, listeners that get torn down and reattached on every render because the handler reference changed, and event objects typed as a generic `Event` instead of the specific shape you actually need. `useEventListener` solves all three problems at once.

- **Stale-Closure Elimination.** The hook stores your `handler` in a `useRef` and keeps that ref synced via `useIsomorphicLayoutEffect` (which resolves to `useLayoutEffect` in the browser and `useEffect` on the server). This means the *actual* function invoked on every event is always the latest one you passed in — but the `addEventListener`/`removeEventListener` effect itself only depends on stable primitives like the target and event name string, so the DOM listener is never thrashed just because your handler closure changed on re-render.
- **Flawless Type Inference.** `useEventListener` is built on a stack of function overloads, so TypeScript automatically narrows the `event` parameter's type based on the `target` you provide. Point it at `window` and you get `WindowEventMap` events; point it at a `Document`, `HTMLElement`, or `SVGElement` (directly or via `RefObject`), and the event type narrows accordingly — no manual casting, no `as MouseEvent` sprinkled through your codebase.
- **SSR/Next.js Ready.** The hook checks for `typeof window === "undefined"` before ever touching the DOM. On the server, the resolved target safely falls back to `null` and the effect becomes a no-op — no crashes during server-side rendering or static generation.

## Import

```tsx
import { useEventListener } from "@himanshu-sorathiya/react-kit";
```

## API Reference

### Arguments

| Argument    | Type                                | Required | Description                                                                                                   |
| ----------- | ----------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------|
| `eventName` | `string \| string[]`                 | Yes      | The DOM event name to listen for, or an array of event names to bind the same handler to multiple events at once. |
| `handler`   | `(event: Event) => void`            | Yes      | The callback invoked when the event fires. Always receives the most up-to-date closure, even without being memoized. |
| `options`   | `UseEventListenerOptions<T>`        | No*      | Configuration object controlling the target element and native listener behavior. Required when targeting anything other than `window`. |

### `options` shape

| Property  | Type                                   | Default  | Description                                                                                     |
| --------- | --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------|
| `target`  | `T \| RefObject<T \| null> \| null`      | `window` | The element (or ref to an element) to attach the listener to. Defaults to `window` when omitted, and safely resolves to `null` on the server. |
| `capture` | `boolean`                                | `false`  | Whether the listener is invoked during the capture phase.                                        |
| `passive` | `boolean`                                | `false`  | Marks the listener as passive, hinting to the browser it will never call `preventDefault()`.     |
| `once`    | `boolean`                                | `false`  | Automatically removes the listener after it fires a single time.                                 |

## Advanced Usage & Examples

### Example 1: Global Window Binding

Bind a global keyboard shortcut directly to `window` — perfect for closing a modal when the user presses `Escape`.

```tsx
import { useEventListener } from "@himanshu-sorathiya/react-kit";

function Modal({ onClose }: { onClose: () => void }) {
	useEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			onClose();
		}
	});

	return <div role="dialog">Modal content</div>;
}
```

### Example 2: Multi-Event Binding on a Ref

Pass an array of events to unify mouse and touch logic on a specific DOM element referenced via `useRef`.

```tsx
import { useRef } from "react";
import { useEventListener } from "@himanshu-sorathiya/react-kit";

function DraggableCard() {
	const cardRef = useRef<HTMLDivElement>(null);

	useEventListener(
		["mousedown", "touchstart"],
		() => {
			console.log("Interaction started");
		},
		{ target: cardRef },
	);

	return <div ref={cardRef}>Drag me</div>;
}
```

## Real-World Use Cases

- Global keyboard hotkeys (e.g., `Escape` to close, `Cmd+K` to open a command palette)
- Click-outside detection for dropdowns, popovers, and modals
- Scroll-position tracking for sticky headers or "back to top" buttons
- Unified drag-and-drop event binding across mouse and touch input
- Visibility change detection (pausing video/polling when a tab is backgrounded)
- Window resize handling for responsive layout recalculations
- Online/offline network status indicators
- Copy/paste event interception for custom clipboard behavior

## Gotchas & Edge Cases

- **Conditional Rendering & Refs (The Late-Mount Gotcha):** If you target an element via `useRef` and that element only renders conditionally *after* the component has already mounted (for example, inside an `if (isOpen) { ... }` block), the hook will **not** automatically attach to it. A plain `useRef` mutation does not trigger a re-render, so the effect's dependency array never sees the ref populate. If you need to attach listeners to conditionally rendered DOM elements, use a **callback ref** or a state-based ref instead, so the hook re-runs once the element actually exists.
- **Multi-Bind Stringification:** When you pass an array of event names (e.g., `['click', 'focus']`), the hook internally joins them into a stable string for its dependency array. This is intentional and safe — it prevents the effect from re-running on every render due to array reference instability, which would otherwise cause infinite re-render loops or unnecessary listener churn.
- **SSR Safety:** On the server, `window` is `undefined`, so the resolved target safely falls back to `null` and the DOM-binding logic is skipped entirely. No errors are thrown during server-side rendering or static generation.

## See Also

- [useDebounce](../../performance/useDebounce/README.md) — for debouncing heavy window events like resizing.
- [useThrottle](../../performance/useThrottle/README.md) — for throttling continuous events like scrolling.
