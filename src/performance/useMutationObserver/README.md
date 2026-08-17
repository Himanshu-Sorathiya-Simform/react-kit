# `useMutationObserver`

A reactive, ergonomic wrapper around the native `MutationObserver` API for watching a DOM subtree for child-list changes, attribute changes, and/or text changes — with two ways to choose a target, debouncing, and a direct passthrough to `takeRecords()`.

## Motivation (Why this hook?)

`MutationObserver` is the right tool whenever something can change the DOM *outside* of React's own render cycle — a third-party script, a browser extension, a `contenteditable` region the user is typing into directly — and you need to react to it. Using it correctly from a component still means the same setup every time: create the observer with the right options object, remember to `disconnect()` it on unmount and on every target/option change, and get the `MutationObserverInit` flags right (several of them have native constraints on how they combine, and getting it wrong throws at runtime, not at compile time).

`useMutationObserver` handles the lifecycle for you:

- **Two targeting modes, one consistent shape.** Attach the returned `ref` to your own JSX element, or pass `target` (a `Node`, `RefObject`, or getter function) to observe something you don't render yourself — the same convention used by [`useResizeObserver`](../useResizeObserver/README.md) and [`useIntersectionObserver`](../useIntersectionObserver/README.md).
- **The full native option set, forwarded as-is.** `childList`, `attributes`, `attributeFilter`, `attributeOldValue`, `characterData`, `characterDataOldValue`, and `subtree` all mean exactly what they mean in the native API — nothing is renamed or reinterpreted.
- **Debouncing built in**, on top of the native batching `MutationObserver` already does per microtask — useful when mutations arrive in frequent, independent bursts and you want to throttle the resulting re-renders further.
- **`takeRecords()` exposed directly**, for the rare case where you need to synchronously flush any mutations not yet delivered — for example, right before reading layout.

## Requirements

Requires **React 19.2+**. Internally, this hook relies on `useEffectEvent` to keep its mutation-handling pipeline reactive without re-subscribing the observer on every render — that API isn't available before 19.2.

## Import

```tsx
// Preferred
import { useMutationObserver } from "@himanshu-sorathiya/react-kit/performance";

// OR
import { useMutationObserver } from "@himanshu-sorathiya/react-kit";
```

## API Reference

### Arguments

| Argument  | Type                                | Required | Description                                                                 |
| --------- | ------------------------------------ | -------- | ----------------------------------------------------------------------------- |
| `options` | `UseMutationObserverOptions<T>`      | No       | Configuration object described below. Omit entirely to use ref-callback mode, watching only `childList` by default. |

### `options` shape

| Property                 | Type                                       | Default              | Description                                                                                     |
| -------------------------- | --------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------- |
| `target`                   | `Node \| RefObject<...> \| (() => ...) \| null` | `undefined` (ref-callback mode) | What to observe. Omit to use the returned `ref` on your own element. Pass a `Node`, `RefObject`, or getter function to observe something you don't render yourself — typed as `Node` (not just `Element`) since the native API also accepts `Document`/`DocumentFragment`. Pass `null` explicitly to disable. |
| `enabled`                  | `boolean`                                     | `true`                 | Pause observing without unmounting. The last delivered `records` are retained, just no longer updated. |
| `debounceMs`               | `number`                                      | `0`                    | Debounce state updates by this many milliseconds, on top of the native per-microtask batching described above. `0` applies every batch immediately. |
| `onMutate`                 | `(mutations, observer) => void`               | `undefined`             | Imperative callback fired on every batch of mutations, in addition to (not instead of) the returned `records` state updating. |
| `childList`                | `boolean`                                     | `true`                 | Watch for child nodes being added or removed.                                                    |
| `attributes`               | `boolean`                                     | `false`                | Watch for attribute value changes.                                                                |
| `attributeFilter`          | `string[]`                                    | `undefined`             | Limits attribute watching to this list of attribute names. See [Gotchas](#gotchas--edge-cases) for how this interacts with `attributes`. |
| `attributeOldValue`        | `boolean`                                     | `false`                | Record each watched attribute's value from *before* the mutation.                                |
| `characterData`            | `boolean`                                     | `false`                | Watch text/comment node data for changes.                                                         |
| `characterDataOldValue`    | `boolean`                                     | `false`                | Record character data's value from *before* the mutation.                                        |
| `subtree`                  | `boolean`                                     | `false`                | Extend `childList`/`attributes`/`characterData` watching to the entire subtree, not just the target node's direct children/self. |

### Return Value

| Property       | Type                              | Description                                                                                     |
| --------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `ref`           | `RefCallback<T>`                    | Attach to your own JSX element to observe it. A no-op (never called) when `target` is supplied instead. |
| `records`       | `MutationRecord[]`                   | The most recent batch of mutation records. Empty until the first batch arrives.                  |
| `takeRecords`   | `() => MutationRecord[]`             | Synchronously flushes and returns any mutation records queued but not yet delivered — a direct passthrough to the native `MutationObserver.takeRecords()`. |

## Advanced Usage & Examples

### Example 1: Dev-Time Safety Net for a React-Managed Container

Warn if something outside React's control — a browser extension, a stray third-party script — mutates a container React thinks it owns exclusively.

```tsx
import { useEffect } from "react";
import { useMutationObserver } from "@himanshu-sorathiya/react-kit/performance";

function ManagedContainer({ children }: { children: React.ReactNode }) {
	const { ref, records } = useMutationObserver<HTMLDivElement>({ subtree: true });

	useEffect(() => {
		if (records.length && process.env.NODE_ENV !== "production") {
			console.warn("Unexpected external DOM mutation inside a React-managed container", records);
		}
	}, [records]);

	return <div ref={ref}>{children}</div>;
}
```

### Example 2: External Target Mode — Watching a Specific Attribute

Watch a specific attribute on an element you don't render, such as a `data-theme` attribute toggled by code outside your component tree.

```tsx
import { useRef } from "react";
import { useMutationObserver } from "@himanshu-sorathiya/react-kit/performance";

function ThemeSync() {
	const rootRef = useRef<HTMLElement>(document.documentElement);

	useMutationObserver({
		target: () => rootRef.current,
		attributes: true,
		attributeFilter: ["data-theme"],
		onMutate: () => syncThemeFromDom(),
	});

	return null;
}
```

### Example 3: Tracking a `contenteditable` Region

React doesn't control what happens inside a `contenteditable` element once the browser takes over — `useMutationObserver` gives you a way to know when its content actually changed.

```tsx
import { useMutationObserver } from "@himanshu-sorathiya/react-kit/performance";

function RichTextEditor() {
	const { ref } = useMutationObserver<HTMLDivElement>({
		childList: true,
		characterData: true,
		subtree: true,
		debounceMs: 300,
		onMutate: () => autosaveDraft(),
	});

	return <div ref={ref} contentEditable suppressContentEditableWarning />;
}
```

## Real-World Use Cases

- A dev-mode integrity check for a container React manages exclusively, flagging unexpected external DOM mutations
- Reacting to `contenteditable` content changes for autosave or word-count features
- Syncing state when a third-party widget (a map, an ad slot, a legacy jQuery plugin) mutates its own DOM
- Watching for attribute changes driven by code outside your component (theming, ARIA state toggled externally)
- Detecting when analytics/consent-management scripts inject or remove elements
- Building dev-tools or debugging overlays that need to know about DOM churn in a specific region

## Gotchas & Edge Cases

- **`attributeFilter`/`attributeOldValue` require `attributes: true`.** The native API throws if either is set while `attributes` is explicitly `false`. If you only need `attributeFilter`, you still need to pass `attributes: true` alongside it.
- **Only `childList` is watched by default.** `attributes`, `characterData`, and `subtree` all default to `false` — an easy thing to forget if you're used to a mutation observer "just working" the way a resize or intersection observer does. Passing no options at all only tells you about direct children being added/removed.
- **`records` is the latest batch, not accumulated history.** Each new batch of mutations replaces the previous `records` value entirely; it isn't appended. If you need a running history, accumulate it yourself inside `onMutate`.
- **Debouncing is layered on top of native batching, not a replacement for it.** `MutationObserver` already delivers all mutations since the last microtask checkpoint as a single batch on its own; `debounceMs` further throttles how often *that* batch triggers a React re-render, which matters when mutations arrive in frequent, separate bursts rather than one large batch.
- **`target: null` vs. omitting `target`.** Omitting `target` means ref-callback mode. Passing `target: null` explicitly means "disabled, observe nothing" — these are not interchangeable.
- **Not used internally by [`useVirtualList`](../../virtualization/useVirtualList/README.md)/[`useVirtualGrid`](../../virtualization/useVirtualGrid/README.md).** Item size tracking there (`measureElement`) is handled by `ResizeObserver`, which reacts specifically to size changes — `MutationObserver` would additionally fire for DOM changes that don't affect size at all, adding overhead without a corresponding benefit for that specific job.

## See Also

- [`useResizeObserver`](../useResizeObserver/README.md) — for tracking element *size*.
- [`useIntersectionObserver`](../useIntersectionObserver/README.md) — for tracking element *visibility*.
- Not currently used internally by [`useVirtualList`](../../virtualization/useVirtualList/README.md) or [`useVirtualGrid`](../../virtualization/useVirtualGrid/README.md) — see the last point in [Gotchas](#gotchas--edge-cases) for why.
