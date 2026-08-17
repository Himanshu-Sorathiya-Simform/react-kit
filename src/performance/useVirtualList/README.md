# `useVirtualList`

A high-performance list virtualization hook: renders only the items currently visible in a scrollable container (plus a small overscan buffer), instead of the full list — with fixed or dynamic item sizing, horizontal/RTL/reverse layouts, automatic size measurement with scroll-jump prevention, and automatic pausing when the list isn't worth tracking.

## Motivation (Why this hook?)

Rendering a list of a few dozen items is free. Rendering a list of ten thousand is not — even with `key`s and reconciliation doing their job, that's ten thousand real DOM nodes sitting in memory and ten thousand potential layout/paint targets. Virtualization fixes this by only ever mounting the items that are actually (or almost) on screen, keeping DOM node count roughly constant no matter how large the underlying list gets.

The hard part of virtualization isn't the basic version — it's everything that comes after: what happens when items don't all have the same height, what happens when your estimate for that height was wrong, what "scroll to index 500" even means before you've rendered index 500, and how to avoid tracking scroll/resize events for a list that's currently hidden in a background tab. `useVirtualList` handles all of it:

- **Fixed or dynamic sizing.** Pass a constant `estimateSize`, or a function for per-item sizes. Attach the returned `measureElement` to your rendered rows and real DOM measurements refine the estimate automatically over time — no manual `resetAfterIndex`-style cache invalidation to manage yourself.
- **Scroll-jump prevention.** When a measured item's real size turns out to differ from the estimate, and that item sits before the current viewport, the hook adjusts the scroll position by the same delta so whatever you're currently looking at doesn't visibly jump.
- **Horizontal, RTL, and reverse layouts**, all through simple flags — no separate hook or API for a chat-style, bottom-anchored list.
- **Works with a dedicated scroll container or the whole page.** `getScrollElement` can return an element, or `window`/`document` to virtualize within the page's own scroll.
- **Automatic pausing.** `enabled` and `pauseWhenOffscreen` stop scroll/resize tracking entirely when the list is inactive or off-screen, without unmounting anything.
- **A full imperative scroll API** — `scrollToIndex`/`scrollToOffset`, with alignment control — for jump-to-item navigation, "scroll to bottom on new message," and similar.

This hook uses [`useResizeObserver`](../useResizeObserver/README.md) internally to track the scroll container's viewport size, and [`useIntersectionObserver`](../useIntersectionObserver/README.md) internally to power `pauseWhenOffscreen` — see [See Also](#see-also). For a 2D (rows *and* columns) version of this same idea, see [`useVirtualGrid`](../useVirtualGrid/README.md).

## Requirements

Requires **React 19.2+**. Both `useResizeObserver` and `useIntersectionObserver` (used internally, see above) rely on `useEffectEvent`, which isn't available before 19.2. `measureElement` also relies on React 19's ability for a ref callback to return its own cleanup function.

## Import

```tsx
// Preferred
import { useVirtualList } from "@himanshu-sorathiya/react-kit/performance";

// OR
import { useVirtualList } from "@himanshu-sorathiya/react-kit";
```

## API Reference

### Arguments

| Argument  | Type                        | Required | Description                                     |
| --------- | ----------------------------- | -------- | -------------------------------------------------- |
| `options` | `UseVirtualListOptions<T>`   | Yes      | Configuration object, grouped and described below. |

### `options` shape

#### Core

| Property           | Type                                             | Description                                                                                     |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `count`             | `number`                                            | Total number of items in the full (un-virtualized) list.                                          |
| `estimateSize`      | `number \| ((index: number) => number)`             | Each item's size along the scrolling axis — a constant, or a function called per-index. If you don't attach `measureElement`, a function here is treated as a fixed size, not just an initial guess. **Memoize it if it's a function** — see [Gotchas](#gotchas--edge-cases). |
| `getScrollElement`  | `() => HTMLElement \| Window \| Document \| null`   | Returns the scrollable element to track. Called fresh every render, so it's safe to pass e.g. `() => scrollRef.current` without memoizing it. Return `window` or `document` to virtualize within the whole page's own scroll. |

#### Layout & Sizing

| Property        | Type      | Default   | Description                                                                                     |
| ---------------- | ----------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `overscan`       | `number`  | `3`         | Extra items rendered beyond each edge of the visible range, to reduce blank flashes during fast scrolling. |
| `horizontal`     | `boolean` | `false`     | Scroll and measure along the horizontal axis (`scrollLeft`/width) instead of vertical.            |
| `reverse`        | `boolean` | `false`     | Render items in reverse physical order — index `0` at the visual bottom/trailing end, `count - 1` at the top/leading end. Suited to chat-style UIs. |
| `isRtl`          | `boolean` | `false`     | RTL horizontal scrolling. Only meaningful with `horizontal: true`.                                |
| `gap`            | `number`  | `0`         | Space between consecutive items. Not added after the last item.                                  |
| `scrollMargin`   | `number`  | `0`         | Distance this list's content starts from the top (or left, if `horizontal`) of a shared scroll container — e.g. page content above it when using `window`/`document` scrolling. |

#### Scroll Position & Initial State

| Property               | Type            | Default   | Description                                                                                     |
| ------------------------ | ----------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `initialOffset`          | `number`         | `undefined` | Scroll to this exact offset on mount, before the first paint. Takes priority over `initialScrollIndex` if both are set. |
| `initialScrollIndex`     | `number`         | `undefined` | Scroll so this index is visible on mount, before the first paint. Ignored if `initialOffset` is also set. |
| `initialScrollAlign`     | `"start" \| "center" \| "end" \| "auto"` | `"start"` | How `initialScrollIndex` is aligned within the viewport. Only used together with `initialScrollIndex`. |
| `initialViewportSize`    | `number`         | `0`         | Assumed viewport size before the scroll container has been measured (e.g. during SSR). Also used as a fallback if a live measurement ever comes back `0`. |

#### Dynamic Measurement

| Property                  | Type      | Default | Description                                                                                     |
| --------------------------- | ----------- | --------- | ------------------------------------------------------------------------------------------------- |
| `adjustScrollOnMeasure`     | `boolean` | `true`    | When `measureElement` (see [Return Value](#return-value)) reports a size for an item positioned before the current viewport, adjust the scroll position by the same delta so already-visible content doesn't jump. Set to `false` to opt out of this behavior. |

#### Performance & Visibility

| Property               | Type                                                          | Default   | Description                                                                                     |
| ------------------------ | ---------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `enabled`                | `boolean`                                                       | `true`      | Pause scroll/resize tracking without unmounting. Virtual items freeze at their last computed state rather than going blank. |
| `pauseWhenOffscreen`     | `boolean \| { root?: Element \| Document \| null; rootMargin?: string }` | `false`     | Also pause scroll/resize tracking whenever the scroll element itself isn't visible on screen (e.g. a hidden tab panel). Has no effect when `getScrollElement` returns `window`/`document`. |
| `scrollingDelay`         | `number`                                                        | `150`       | How long scrolling must stay idle before `isScrolling` flips back to `false`. `0` resolves it immediately rather than disabling the tracking altogether. |

#### Data & Keys

| Property   | Type                                                                 | Default | Description                                                                                     |
| ----------- | ----------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `data`      | `T[]`                                                                    | `undefined` | Backing data array, used together with a string/string-array `itemKey` to derive each item's key. Not required when `itemKey` is a function or omitted entirely. |
| `itemKey`   | `string \| string[] \| ((index: number, item?: T) => string \| number)` | `undefined` | How to derive each rendered item's React `key` — see [Gotchas](#gotchas--edge-cases) for the three accepted forms. Falls back to `index` if unset or unresolvable. |

#### Callbacks

| Property        | Type                              | Description                                                                                     |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `onRangeChange`   | `(range: { startIndex: number; endIndex: number }) => void` | Called whenever the rendered index range actually changes (not on every render). Useful for analytics, or triggering data-fetching (e.g. infinite scroll) from outside the hook. |

### Return Value

| Property         | Type                                                              | Description                                                                                     |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `virtualItems`     | `VirtualItem[]`                                                      | The currently-rendered items (visible range plus overscan). Each has `key`, `index`, `size`, `start`, `end`. Render these, not the full `count`. |
| `totalSize`        | `number`                                                             | Total size of all items plus gaps. Set as the virtualized container's height (or width, if `horizontal`) so the scrollbar is sized correctly. |
| `isScrolling`      | `boolean`                                                            | Whether the list is currently scrolling, per `scrollingDelay`. Useful for cheaper rendering (skipping expensive item content) while actively scrolling. |
| `scrollToIndex`    | `(index: number, options?: { align?; smooth? }) => void`            | Imperatively scrolls so the given index is visible. Stable across renders.                       |
| `scrollToOffset`   | `(offset: number, options?: { smooth? }) => void`                    | Imperatively scrolls to an exact offset, clamped into range. Stable across renders.               |
| `measureElement`   | `RefCallback<Element>`                                               | Attach to your rendered item's DOM node to enable dynamic measurement — see [Example 2](#example-2-dynamic-sizing-with-measureelement) and [Gotchas](#gotchas--edge-cases). No-op when `estimateSize` is a plain number. |

## Advanced Usage & Examples

### Example 1: Basic Fixed-Size List

The foundational pattern every other example builds on: a scroll container, a full-height spacer, and absolutely-positioned items.

```tsx
import { useRef } from "react";
import { useVirtualList } from "@himanshu-sorathiya/react-kit/performance";

function List({ items }: { items: string[] }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { virtualItems, totalSize } = useVirtualList({
		count: items.length,
		estimateSize: 40,
		getScrollElement: () => scrollRef.current,
	});

	return (
		<div ref={scrollRef} style={{ height: 400, overflow: "auto" }}>
			<div style={{ height: totalSize, position: "relative" }}>
				{virtualItems.map((item) => (
					<div
						key={item.key}
						style={{ position: "absolute", top: item.start, height: item.size }}
					>
						{items[item.index]}
					</div>
				))}
			</div>
		</div>
	);
}
```

### Example 2: Dynamic Sizing with `measureElement`

Items with unpredictable heights (wrapped text, images, variable content). `estimateSize` only needs to be a reasonable starting guess — attaching `measureElement` refines it with real measurements as items render.

```tsx
import { useRef } from "react";
import { useVirtualList } from "@himanshu-sorathiya/react-kit/performance";

function CommentThread({ comments }: { comments: Comment[] }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { virtualItems, totalSize, measureElement } = useVirtualList({
		count: comments.length,
		estimateSize: () => 80, // rough guess; refined per-item after first render
		getScrollElement: () => scrollRef.current,
	});

	return (
		<div ref={scrollRef} style={{ height: 500, overflow: "auto" }}>
			<div style={{ height: totalSize, position: "relative" }}>
				{virtualItems.map((item) => (
					<div
						key={item.key}
						ref={measureElement}
						data-index={item.index}
						style={{ position: "absolute", top: item.start, width: "100%" }}
					>
						{comments[item.index].text}
					</div>
				))}
			</div>
		</div>
	);
}
```

### Example 3: Reverse Layout for a Chat UI

`reverse` places index `0` at the visual bottom, growing upward — combined with `initialScrollIndex` set to the last index, the view opens already scrolled to the newest message.

```tsx
import { useRef } from "react";
import { useVirtualList } from "@himanshu-sorathiya/react-kit/performance";

function ChatWindow({ messages }: { messages: Message[] }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { virtualItems, totalSize, measureElement } = useVirtualList({
		count: messages.length,
		estimateSize: () => 60,
		getScrollElement: () => scrollRef.current,
		reverse: true,
		initialScrollIndex: messages.length - 1,
	});

	return (
		<div ref={scrollRef} style={{ height: 500, overflow: "auto" }}>
			<div style={{ height: totalSize, position: "relative" }}>
				{virtualItems.map((item) => (
					<div
						key={item.key}
						ref={measureElement}
						data-index={item.index}
						style={{ position: "absolute", top: item.start, width: "100%" }}
					>
						{messages[item.index].text}
					</div>
				))}
			</div>
		</div>
	);
}
```

### Example 4: Whole-Page Scrolling with `scrollMargin`

Virtualize a list embedded partway down a normal page, using the page's own scroll instead of a fixed-height container. `scrollMargin` tells the hook how much content precedes the list, so its internal scroll-position math stays correct.

```tsx
import { useRef, useLayoutEffect, useState } from "react";
import { useVirtualList } from "@himanshu-sorathiya/react-kit/performance";

function ArticleFeed({ articles }: { articles: Article[] }) {
	const listRef = useRef<HTMLDivElement>(null);
	const [scrollMargin, setScrollMargin] = useState(0);

	useLayoutEffect(() => {
		setScrollMargin(listRef.current?.offsetTop ?? 0);
	}, []);

	const { virtualItems, totalSize } = useVirtualList({
		count: articles.length,
		estimateSize: 200,
		getScrollElement: () => window,
		scrollMargin,
	});

	return (
		<div ref={listRef} style={{ position: "relative", height: totalSize }}>
			{virtualItems.map((item) => (
				<div key={item.key} style={{ position: "absolute", top: item.start }}>
					{articles[item.index].title}
				</div>
			))}
		</div>
	);
}
```

## Real-World Use Cases

- Chat and messaging apps (`reverse` + `initialScrollIndex`)
- Social media feeds with variable-height posts (`measureElement`)
- Large data tables, log viewers, or terminal-style output
- File/folder browsers with thousands of entries
- Comment threads
- Search results lists
- Notification centers
- Infinite-scroll feeds, using `onRangeChange` to trigger loading the next page as the end of the current range approaches `count`

## Gotchas & Edge Cases

- **`measureElement` needs `data-index` on the element it's attached to**, and works best passed directly as `ref={measureElement}` rather than wrapped in an inline arrow function (`ref={(el) => measureElement(el)}`) — the direct form keeps it referentially stable across renders, avoiding unnecessary detach/reattach churn.
- **A function `estimateSize` should be memoized.** Passing a new inline function every render (e.g. written directly in JSX) rebuilds the hook's internal size cache from scratch on every render, defeating its purpose. Wrap it in `useCallback`, or define it outside the component if it doesn't depend on props/state.
- **`reverse` flips what `"start"`/`"end"` alignment mean, but `"auto"` doesn't.** `"start"`/`"end"` are relative to the *logical* reading direction, which visually flips under `reverse` — but `"auto"` always scrolls the minimum physical distance needed, regardless of `reverse`, since "nearest" is a property of the screen, not the list's direction.
- **`pauseWhenOffscreen` has no effect when `getScrollElement` returns `window`/`document`.** A whole-page scroller has no meaningful "offscreen" state of its own to detect.
- **`isRtl` uses the modern (negative `scrollLeft`) RTL convention** used by current evergreen browsers. It hasn't been exhaustively verified across every browser/version combination.
- **`itemKey` has three forms, tried in this order of intent:** a function `(index, item?) => key` you fully control; a **string**, treated as a dot-separated property path into `data[index]` (e.g. `"name.first"`); or a **string array**, the same path pre-split into segments (useful when a real property name itself contains a literal dot). If `data` is missing, the resolved value isn't a `string`/`number`, or `itemKey` is unset, the item's `index` is used as the key instead.
- **`scrollingDelay: 0` doesn't disable `isScrolling` tracking** — it resolves `isScrolling` back to `false` immediately instead of after a delay.
- **`VirtualItem.start`/`.end` exclude `scrollMargin`** — they're relative to the top/left of the virtualized content itself, not the page. Position your items with `start` directly; you don't need to add `scrollMargin` back in yourself.
- **SSR is safe by construction, not by special-casing.** `getScrollElement` naturally returns `null` on the server and during the first client render before refs attach, so server and pre-hydration client output match — no hydration mismatch warnings.

## See Also

- [`useVirtualGrid`](../useVirtualGrid/README.md) — the 2D (rows and columns) counterpart to this hook.
- [`useResizeObserver`](../useResizeObserver/README.md) — used internally to track the scroll container's viewport size, and (via the native `ResizeObserver` API directly) to power `measureElement`.
- [`useIntersectionObserver`](../useIntersectionObserver/README.md) — used internally to power `pauseWhenOffscreen`.
- [`useMutationObserver`](../useMutationObserver/README.md) — not used internally; see its own README for why `ResizeObserver` is the better fit for size tracking specifically.
