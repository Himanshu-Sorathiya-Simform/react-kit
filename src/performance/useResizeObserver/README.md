# `useResizeObserver`

A reactive, ergonomic wrapper around the native `ResizeObserver` API for tracking an element's — or the window's — rendered size, with two ways to choose a target, sub-pixel jitter control, debouncing, and full SSR safety.

## Motivation (Why this hook?)

Wiring up `ResizeObserver` by hand looks trivial for a single element, and then stops looking trivial the moment you need anything more: `ResizeObserver` can't observe `Window` or `Document` at all, so window-size tracking needs an entirely different code path; the callback can fire on sub-pixel changes, which is often far more precision than a layout decision needs and translates directly into extra re-renders; and you're responsible for creating, observing, and disconnecting the observer yourself, correctly, on every target change and unmount.

`useResizeObserver` handles all of that:

- **Two targeting modes, one consistent shape.** Attach the returned `ref` to your own JSX element (the common case), or pass `target` to observe an element you don't render yourself — a plain element, a `RefObject`, or a getter function like `() => scrollRef.current`. The getter form is re-resolved on every render, so it's safe to pass inline without memoizing it.
- **`Window`/`Document` handled correctly.** The native API can only `observe()` an `Element`, so pointing this hook at `window` or `document` falls back to tracking `document.documentElement`'s size internally — you don't need a separate code path for "the whole page is my container."
- **Sub-pixel jitter under your control.** Pass `round: true` to round measurements to whole pixels before they ever reach React state, cutting down on re-renders triggered by layout noise that's smaller than a CSS pixel.
- **Debouncing built in.** `debounceMs` throttles how often the measured size updates React state, independent of how often the browser's own `ResizeObserver` delivery batches fire.
- **SSR-safe.** `width`/`height` start at `0` (or your own `initialSize`) and only become real once the first measurement resolves on the client — no crashes, no `ResizeObserver is not defined` during server rendering.

This hook is also what [`useVirtualList`](../../virtualization/useVirtualList/README.md) and [`useVirtualGrid`](../../virtualization/useVirtualGrid/README.md) use internally to track their scroll container's viewport size — see [See Also](#see-also).

## Requirements

Requires **React 19.2+**. Internally, this hook relies on `useEffectEvent` to keep its measurement pipeline reactive without re-subscribing the observer on every render — that API isn't available before 19.2.

## Import

```tsx
// Preferred
import { useResizeObserver } from "@himanshu-sorathiya/react-kit/performance";

// OR
import { useResizeObserver } from "@himanshu-sorathiya/react-kit";
```

## API Reference

### Arguments

| Argument  | Type                                | Required | Description                                                                 |
| --------- | ------------------------------------ | -------- | ----------------------------------------------------------------------------- |
| `options` | `UseResizeObserverOptions<T>`        | No       | Configuration object described below. Omit entirely to use ref-callback mode with all defaults. |

### `options` shape

| Property      | Type                                                              | Default              | Description                                                                                     |
| -------------- | ------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------- |
| `target`       | `Element \| Document \| Window \| RefObject<...> \| (() => ...) \| null` | `undefined` (ref-callback mode) | What to observe. Omit to use the returned `ref` on your own element. Pass an element, `Document`, `Window`, a `RefObject`, or a getter function to observe something you don't render yourself. Pass `null` explicitly to disable observing entirely. |
| `box`          | `"content-box" \| "border-box" \| "device-pixel-content-box"`      | `"content-box"`       | Which CSS box model to measure. Ignored when the target is `Window`. `"device-pixel-content-box"` falls back to `"content-box"` on browsers that don't populate that field. |
| `enabled`      | `boolean`                                                           | `true`                | Pause observing without unmounting. The last measured `width`/`height` is retained, just no longer updated. |
| `round`        | `boolean`                                                           | `false`               | Round `width`/`height` to whole pixels before updating state, to reduce re-renders from sub-pixel layout jitter. |
| `debounceMs`   | `number`                                                            | `0`                   | Debounce measurement updates by this many milliseconds. `0` applies every measurement immediately. |
| `initialSize`  | `{ width: number; height: number }`                                 | `{ width: 0, height: 0 }` | Value returned before the first real measurement resolves — useful to avoid a `0 x 0` flash when you already know an element's rough starting size. |
| `onResize`     | `(size, entry) => void`                                             | `undefined`            | Imperative callback fired on every measurement update, in addition to (not instead of) the returned state updating. `entry` is `undefined` for `Window` targets. |

### Return Value

| Property | Type                                    | Description                                                                                     |
| --------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `ref`     | `RefCallback<T>`                          | Attach to your own JSX element to observe it. A no-op (never called) when `target` is supplied instead. |
| `width`   | `number`                                  | Latest measured width. `0` until the first measurement (or `initialSize.width`, if provided).    |
| `height`  | `number`                                  | Latest measured height. `0` until the first measurement (or `initialSize.height`, if provided).  |
| `entry`   | `ResizeObserverEntry \| undefined`        | The raw entry from the most recent measurement, for reading fields not surfaced directly (e.g. `borderBoxSize` alongside a `content-box` measurement). `undefined` before the first measurement and always for `Window` targets. |

## Advanced Usage & Examples

### Example 1: Responsive Component (Ref-Callback Mode)

Switch layout based on an element's own rendered width — a lightweight alternative to CSS container queries when you need the width in JS, not just CSS.

```tsx
import { useResizeObserver } from "@himanshu-sorathiya/react-kit/performance";

function Sidebar() {
	const { ref, width } = useResizeObserver<HTMLDivElement>();

	return (
		<div ref={ref}>
			{width < 200 ? <CompactNav /> : <FullNav />}
		</div>
	);
}
```

### Example 2: External Target Mode

Observe an element you don't render yourself — for example, a scroll container owned by another part of your component.

```tsx
import { useRef } from "react";
import { useResizeObserver } from "@himanshu-sorathiya/react-kit/performance";

function Chart() {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { width, height } = useResizeObserver({
		target: () => scrollRef.current,
	});

	return (
		<div ref={scrollRef} style={{ overflow: "auto" }}>
			<canvas width={width} height={height} />
		</div>
	);
}
```

### Example 3: Debounced and Rounded, for a Drag-Resize Panel

During an active drag-resize, the browser can fire many measurements per second. Debouncing and rounding keep re-renders (and any expensive redraw triggered by `onResize`) to a manageable rate.

```tsx
import { useResizeObserver } from "@himanshu-sorathiya/react-kit/performance";

function ResizablePreviewPane() {
	const { ref, width, height } = useResizeObserver<HTMLDivElement>({
		round: true,
		debounceMs: 100,
		onResize: (size) => redrawExpensivePreview(size),
	});

	return <div ref={ref} style={{ resize: "both", overflow: "auto" }} />;
}
```

## Real-World Use Cases

- Responsive components that need real pixel widths in JS, not just CSS breakpoints
- Redrawing a `<canvas>`, chart, or WebGL scene to match its container's current size
- Syncing a sticky/collapsing header's height into a CSS variable for layout below it
- Auto-growing a `<textarea>`-adjacent layout as content wraps
- Tracking a drag-resizable panel's dimensions for a live preview
- Powering a virtualized list or grid's viewport-size tracking (see [`useVirtualList`](../../virtualization/useVirtualList/README.md))

## Gotchas & Edge Cases

- **`Window`/`Document` size excludes the scrollbar.** For these targets, the hook reads `document.documentElement.clientWidth`/`clientHeight` — not `window.innerWidth`/`innerHeight`. If you're used to `innerWidth`-style behavior (scrollbar included), the numbers here will be a few pixels narrower on platforms with visible scrollbars.
- **`entry` is always `undefined` for `Window` targets.** Window sizing is tracked via the native `resize` event, not `ResizeObserver` (which can't observe `Window`), so there's no `ResizeObserverEntry` to hand back.
- **The very first render is always unmeasured.** `width`/`height` start at `0` (or `initialSize`) both during SSR and on the first client render, since the real measurement only resolves asynchronously after mount. Don't gate critical first-paint logic on a non-zero size without an `initialSize` fallback.
- **`target: null` vs. omitting `target`.** Omitting `target` (or passing `undefined`) means ref-callback mode — attach `ref` yourself. Passing `target: null` explicitly means "disabled, observe nothing," even if you also attach `ref` somewhere. These are not interchangeable.
- **`round: true` trades precision for fewer re-renders.** If you need exact sub-pixel values (e.g. for pixel-perfect canvas sizing), leave it `false` — the option exists specifically to accept the imprecision for stability.

## See Also

- [`useIntersectionObserver`](../useIntersectionObserver/README.md) — for tracking element *visibility*, not size.
- [`useMutationObserver`](../useMutationObserver/README.md) — for tracking DOM structure/attribute changes.
- Used internally by [`useVirtualList`](../../virtualization/useVirtualList/README.md) and [`useVirtualGrid`](../../virtualization/useVirtualGrid/README.md) to track their scroll container's viewport size.
