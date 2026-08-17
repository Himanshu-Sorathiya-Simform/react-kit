# `useIntersectionObserver`

A reactive, ergonomic wrapper around the native `IntersectionObserver` API for tracking whether an element is visible relative to a root (the viewport, by default) — with two ways to choose a target, a one-shot "freeze once visible" mode, debouncing, and full SSR safety.

## Motivation (Why this hook?)

`IntersectionObserver` itself is already a fairly ergonomic API, but using it correctly from inside a component still means writing the same boilerplate every time: create the observer, remember to `disconnect()` it on unmount and whenever the target changes, decide whether you actually want continuous updates or just a one-time "has this appeared yet" signal, and — if you pass a `threshold` array — avoid accidentally tearing down and recreating the observer on every render because the array literal is a new reference each time.

`useIntersectionObserver` handles all of that:

- **Two targeting modes, one consistent shape.** Attach the returned `ref` to your own JSX element, or pass `target` (an element, `RefObject`, or getter function) to observe something you don't render yourself — the same convention used by [`useResizeObserver`](../useResizeObserver/README.md).
- **`freezeOnceVisible` for lazy-load-once patterns.** Once the target intersects for the first time, the observer disconnects entirely and `isIntersecting` stays `true` for good — there's no ongoing cost to keep observing something that's already done its job.
- **Safe with inline `threshold` arrays.** Pass `threshold: [0, 0.25, 0.5, 0.75, 1]` directly in your JSX without memoizing it — the hook tracks the array's *content*, not its reference, so it won't tear down and recreate the observer every render.
- **Debouncing built in.** `debounceMs` throttles how often `isIntersecting`/`intersectionRatio` update React state.
- **SSR-safe.** `isIntersecting` starts at `false` (or your own `initialIsIntersecting`) and only reflects reality once the first observation resolves on the client.

This hook is also what [`useVirtualList`](../../virtualization/useVirtualList/README.md) and [`useVirtualGrid`](../../virtualization/useVirtualGrid/README.md) use internally to power their `pauseWhenOffscreen` option — see [See Also](#see-also).

## Requirements

Requires **React 19.2+**. Internally, this hook relies on `useEffectEvent` to keep its observation pipeline reactive without re-subscribing the observer on every render — that API isn't available before 19.2.

## Import

```tsx
// Preferred
import { useIntersectionObserver } from "@himanshu-sorathiya/react-kit/performance";

// OR
import { useIntersectionObserver } from "@himanshu-sorathiya/react-kit";
```

## API Reference

### Arguments

| Argument  | Type                                    | Required | Description                                                                 |
| --------- | ----------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `options` | `UseIntersectionObserverOptions<T>`       | No       | Configuration object described below. Omit entirely to use ref-callback mode with all defaults. |

### `options` shape

| Property                | Type                                                        | Default              | Description                                                                                     |
| ------------------------ | ------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------- |
| `target`                 | `Element \| RefObject<...> \| (() => ...) \| null`           | `undefined` (ref-callback mode) | What to observe. Omit to use the returned `ref` on your own element. Pass an element, `RefObject`, or getter function to observe something you don't render yourself. Pass `null` explicitly to disable. Unlike `useResizeObserver`, there's no `Document`/`Window` option here — the native API only accepts an `Element`. |
| `root`                   | `Element \| Document \| null`                                 | `null` (browser viewport) | The element used as the viewport when checking for intersection. Must be an ancestor of the observed target, or `null` for the browser viewport. |
| `rootMargin`              | `string`                                                     | `"0px"`               | Margin added around `root`'s bounding box before computing intersections, in CSS `margin` shorthand (e.g. `"200px 0px"` to start intersecting 200px early). |
| `threshold`               | `number \| number[]`                                          | `0`                   | The intersection ratio (or ratios) at which the callback fires. An array fires at each threshold crossed — useful for progressive/scroll-linked effects. |
| `enabled`                 | `boolean`                                                    | `true`                | Pause observing without unmounting. `isIntersecting`/`intersectionRatio` are retained at their last values. |
| `freezeOnceVisible`       | `boolean`                                                    | `false`               | Disconnect the observer permanently once the target intersects for the first time; `isIntersecting` stays latched `true`. A new target (if `target`/the rendered element changes) gets a fresh chance. |
| `initialIsIntersecting`   | `boolean`                                                    | `false`                | Value returned before the first observation resolves.                                            |
| `debounceMs`              | `number`                                                     | `0`                    | Debounce state updates by this many milliseconds. `0` applies every observation immediately.      |
| `onChange`                | `(isIntersecting, entry) => void`                              | `undefined`             | Imperative callback fired on every observation update, in addition to (not instead of) the returned state updating. |

### Return Value

| Property             | Type                                        | Description                                                                                     |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `ref`                 | `RefCallback<T>`                              | Attach to your own JSX element to observe it. A no-op (never called) when `target` is supplied instead. |
| `isIntersecting`      | `boolean`                                     | Whether the target currently intersects `root`, per the last observation.                        |
| `intersectionRatio`   | `number`                                      | How much of the target is currently visible, from `0` (none) to `1` (fully visible).              |
| `entry`               | `IntersectionObserverEntry \| undefined`      | The raw entry from the most recent observation. `undefined` before the first one.                 |

## Advanced Usage & Examples

### Example 1: Lazy-Load an Image, Then Stop Observing

The most common use case — defer loading until the element is actually about to be visible, then let the observer disconnect since there's nothing left to track.

```tsx
import { useIntersectionObserver } from "@himanshu-sorathiya/react-kit/performance";

function LazyImage({ src, alt }: { src: string; alt: string }) {
	const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
		freezeOnceVisible: true,
		rootMargin: "200px", // start loading slightly before it's on screen
	});

	return <div ref={ref}>{isIntersecting && <img src={src} alt={alt} />}</div>;
}
```

### Example 2: External Target Mode — Infinite Scroll Sentinel

Watch a sentinel element you don't render as part of your main list markup, without needing your own `ref` prop plumbed through.

```tsx
import { useRef } from "react";
import { useIntersectionObserver } from "@himanshu-sorathiya/react-kit/performance";

function InfiniteList() {
	const sentinelRef = useRef<HTMLDivElement>(null);

	useIntersectionObserver({
		target: () => sentinelRef.current,
		onChange: (visible) => visible && loadNextPage(),
	});

	return (
		<>
			<ItemList />
			<div ref={sentinelRef} />
		</>
	);
}
```

### Example 3: Progressive Effect with a Threshold Array

Fade an element in gradually as it scrolls into view, using `intersectionRatio` directly rather than a boolean.

```tsx
import { useIntersectionObserver } from "@himanshu-sorathiya/react-kit/performance";

function FadeInSection({ children }: { children: React.ReactNode }) {
	const { ref, intersectionRatio } = useIntersectionObserver<HTMLDivElement>({
		threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
	});

	return (
		<div ref={ref} style={{ opacity: intersectionRatio }}>
			{children}
		</div>
	);
}
```

## Real-World Use Cases

- Lazy-loading images, iframes, or other heavy embeds
- Infinite-scroll "load more" triggers
- Scroll-spy navigation (highlighting the current section as it scrolls into view)
- Fade/slide-in-on-scroll animations
- Ad or content viewability tracking
- Auto-pausing a video or animation when it scrolls off-screen
- Skipping expensive work for widgets that aren't currently on screen — the exact mechanism behind [`useVirtualList`](../../virtualization/useVirtualList/README.md)/[`useVirtualGrid`](../../virtualization/useVirtualGrid/README.md)'s `pauseWhenOffscreen` option

## Gotchas & Edge Cases

- **`root` must be an ancestor of the observed target**, or the intersection can never be computed (the native API will simply never report an intersection). Leave it `null` for the default browser-viewport behavior unless you specifically need to scope visibility to a scrollable container.
- **`freezeOnceVisible` unfreezes automatically for a new element.** If the element behind `ref` (or `target`) changes — a remount, a different node — that new element gets its own fresh chance to be observed, even if a previous element had already frozen `isIntersecting` at `true`.
- **`rootMargin` needs units, like real CSS.** `"200"` is invalid; it needs to be `"200px"`. This is a common typo since it looks like it should just be a number.
- **`entry`/`intersectionRatio` reflect the *last* observation, not a continuous stream.** The browser only fires the callback when a `threshold` is crossed, not on every scroll frame — for smooth, continuous scroll-position tracking (rather than visibility), this isn't the right tool.
- **`target: null` vs. omitting `target`.** Omitting `target` means ref-callback mode. Passing `target: null` explicitly means "disabled, observe nothing" — these are not interchangeable.

## See Also

- [`useResizeObserver`](../useResizeObserver/README.md) — for tracking element *size*, not visibility.
- [`useMutationObserver`](../useMutationObserver/README.md) — for tracking DOM structure/attribute changes.
- Used internally by [`useVirtualList`](../../virtualization/useVirtualList/README.md) and [`useVirtualGrid`](../../virtualization/useVirtualGrid/README.md)'s `pauseWhenOffscreen` option, to detect when the scroll container itself leaves the viewport.
