# `useVirtualGrid`

A high-performance 2D grid virtualization hook: renders only the cells currently visible in a scrollable container (plus a small overscan buffer on each axis), instead of the full `rowCount x colCount` grid — with independent fixed or dynamic sizing per axis, automatic size measurement with scroll-jump prevention, and automatic pausing when the grid isn't worth tracking.

## Motivation (Why this hook?)

Everything that makes list virtualization necessary applies twice over to a grid — a 1,000-row x 50-column spreadsheet is 50,000 potential cells, not 1,000 rows. `useVirtualGrid` is [`useVirtualList`](../useVirtualList/README.md)'s two-axis counterpart, built for exactly that shape of problem:

- **Independent sizing per axis.** Row height and column width are configured, measured, and cached completely separately — a grid with uniform column widths but variable row heights (or vice versa) doesn't pay for complexity it doesn't need.
- **Dynamic sizing with correct row/column semantics.** Attach `measureElement` to your rendered cells, and a row's height becomes the max measured height among its *currently-rendered* cells (likewise for column width) — not just "whatever the last measured cell happened to report." If a row's tallest cell later shrinks, the row shrinks back down with it, not just up.
- **Scroll-jump prevention on both axes independently.** A row-height correction adjusts vertical scroll; a column-width correction adjusts horizontal scroll — each only when the correction applies to a row/column positioned before the current viewport.
- **Works with a dedicated scroll container or the whole page**, same as `useVirtualList`.
- **Automatic pausing** via `enabled`/`pauseWhenOffscreen`, same as `useVirtualList`.
- **A full imperative scroll API** — `scrollToRow`, `scrollToColumn`, `scrollToCell`, `scrollToOffset` — for keyboard navigation, jump-to-cell, and similar.

This hook uses [`useResizeObserver`](../useResizeObserver/README.md) internally to track the scroll container's viewport size, and [`useIntersectionObserver`](../useIntersectionObserver/README.md) internally to power `pauseWhenOffscreen` — see [See Also](#see-also). For a 1D (list) version of this same idea, see [`useVirtualList`](../useVirtualList/README.md).

## Requirements

Requires **React 19.2+**. Both `useResizeObserver` and `useIntersectionObserver` (used internally, see above) rely on `useEffectEvent`, which isn't available before 19.2. `measureElement` also relies on React 19's ability for a ref callback to return its own cleanup function.

## Import

```tsx
// Preferred
import { useVirtualGrid } from "@himanshu-sorathiya/react-kit/performance";

// OR
import { useVirtualGrid } from "@himanshu-sorathiya/react-kit";
```

## API Reference

### Arguments

| Argument  | Type                        | Required | Description                                     |
| --------- | ----------------------------- | -------- | -------------------------------------------------- |
| `options` | `UseVirtualGridOptions`      | Yes      | Configuration object, grouped and described below. |

### `options` shape

#### Core

| Property               | Type                                             | Description                                                                                     |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `rowCount`               | `number`                                            | Total number of rows in the full (un-virtualized) grid.                                           |
| `colCount`               | `number`                                            | Total number of columns in the full (un-virtualized) grid.                                        |
| `estimateRowHeight`      | `number \| ((rowIndex: number) => number)`          | Each row's height — a constant, or a function called per row index. **Memoize it if it's a function** — see [Gotchas](#gotchas--edge-cases). |
| `estimateColumnWidth`    | `number \| ((colIndex: number) => number)`          | Each column's width — a constant, or a function called per column index. Same memoization note applies. |
| `getScrollElement`       | `() => HTMLElement \| Window \| Document \| null`   | Returns the scrollable element to track. Called fresh every render — safe to pass e.g. `() => scrollRef.current` without memoizing it. Return `window`/`document` to virtualize within the page's own scroll. |

#### Layout & Sizing

| Property               | Type      | Default   | Description                                                                                     |
| ------------------------ | ----------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `overscanRows`           | `number`  | `3`         | Extra rows rendered beyond each edge of the visible range.                                       |
| `overscanCols`           | `number`  | `3`         | Extra columns rendered beyond each edge of the visible range.                                     |
| `isRtl`                  | `boolean` | `false`     | RTL horizontal scrolling — affects the column axis only.                                          |
| `rowGap`                 | `number`  | `0`         | Space between rows. Not added after the last row.                                                 |
| `columnGap`              | `number`  | `0`         | Space between columns. Not added after the last column.                                           |
| `scrollMarginTop`        | `number`  | `0`         | Distance this grid's content starts from the top of a shared scroll container.                    |
| `scrollMarginLeft`       | `number`  | `0`         | Distance this grid's content starts from the left of a shared scroll container.                   |

> There's no `reverse` option here, unlike `useVirtualList` — grids don't support reversed axes.

#### Scroll Position & Initial State

| Property               | Type            | Default   | Description                                                                                     |
| ------------------------ | ----------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `initialScrollTop`       | `number`         | `undefined` | Scroll to this exact vertical offset on mount, before the first paint. Takes priority over `initialScrollRow` if both are set. |
| `initialScrollLeft`      | `number`         | `undefined` | Scroll to this exact horizontal offset on mount, before the first paint. Takes priority over `initialScrollCol` if both are set. |
| `initialScrollRow`       | `number`         | `undefined` | Scroll so this row is visible on mount. Ignored if `initialScrollTop` is also set.                |
| `initialScrollCol`       | `number`         | `undefined` | Scroll so this column is visible on mount. Ignored if `initialScrollLeft` is also set.            |
| `initialRowAlign`        | `"start" \| "center" \| "end" \| "auto"` | `"start"` | How `initialScrollRow` is aligned within the viewport. Only used with `initialScrollRow`.         |
| `initialColAlign`        | `"start" \| "center" \| "end" \| "auto"` | `"start"` | How `initialScrollCol` is aligned within the viewport. Only used with `initialScrollCol`.         |
| `initialViewportHeight`  | `number`         | `0`         | Assumed viewport height before the scroll container has been measured.                            |
| `initialViewportWidth`   | `number`         | `0`         | Assumed viewport width before the scroll container has been measured.                             |

#### Dynamic Measurement

| Property                  | Type      | Default | Description                                                                                     |
| --------------------------- | ----------- | --------- | ------------------------------------------------------------------------------------------------- |
| `adjustScrollOnMeasure`     | `boolean` | `true`    | When `measureElement` (see [Return Value](#return-value)) reports a size for a row/column positioned before the current viewport, adjust `scrollTop`/`scrollLeft` by the same delta so already-visible content doesn't jump. Set to `false` to opt out. |

#### Performance & Visibility

| Property               | Type                                                          | Default   | Description                                                                                     |
| ------------------------ | ---------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `enabled`                | `boolean`                                                       | `true`      | Pause scroll/resize tracking without unmounting. Virtual cells freeze at their last computed state rather than going blank. |
| `pauseWhenOffscreen`     | `boolean \| { root?: Element \| Document \| null; rootMargin?: string }` | `false`     | Also pause scroll/resize tracking whenever the scroll element itself isn't visible on screen. Has no effect when `getScrollElement` returns `window`/`document`. |
| `scrollingDelay`         | `number`                                                        | `150`       | How long scrolling must stay idle before `isScrolling` flips back to `false`. `0` resolves it immediately rather than disabling the tracking altogether. |

#### Data & Keys

| Property   | Type                                          | Default | Description                                                                                     |
| ----------- | ------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------- |
| `itemKey`   | `(rowIndex: number, colIndex: number) => string \| number` | `undefined` | Derives each rendered cell's React `key`. Falls back to `` `${rowIndex}:${colIndex}` `` if unset. Unlike `useVirtualList`'s `itemKey`, this is function-only — cells aren't naturally tied to a single flat data array the way list items are. |

#### Callbacks

| Property        | Type                              | Description                                                                                     |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `onRangeChange`   | `(range: { rowStartIndex; rowEndIndex; colStartIndex; colEndIndex }) => void` | Called whenever the rendered row *or* column index range actually changes (not on every render). |

### Return Value

| Property         | Type                                                              | Description                                                                                     |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `virtualCells`     | `VirtualCell[]`                                                      | The currently-rendered cells (visible rows x visible columns, plus overscan). Each has `key`, `rowIndex`, `colIndex`, `height`, `width`, `top`, `left`, `bottom`, `right`. Render these, not the full `rowCount x colCount`. |
| `totalHeight`      | `number`                                                             | Total height of all rows plus row gaps. Set as the virtualized container's height.               |
| `totalWidth`       | `number`                                                             | Total width of all columns plus column gaps. Set as the virtualized container's width.           |
| `isScrolling`      | `boolean`                                                            | Whether the grid is currently scrolling, per `scrollingDelay`.                                    |
| `scrollToCell`     | `(rowIndex, colIndex, options?: { rowAlign?; colAlign?; smooth? }) => void` | Imperatively scrolls so the given cell is visible on both axes. Stable across renders.           |
| `scrollToOffset`   | `(offsets: { top: number; left: number }, options?: { smooth? }) => void` | Imperatively scrolls to exact top/left offsets, each clamped into range. Stable across renders.  |
| `scrollToRow`      | `(rowIndex: number, options?: { align?; smooth? }) => void`         | Imperatively scrolls so the given row is visible, leaving horizontal scroll untouched.            |
| `scrollToColumn`   | `(colIndex: number, options?: { align?; smooth? }) => void`         | Imperatively scrolls so the given column is visible, leaving vertical scroll untouched.           |
| `measureElement`   | `RefCallback<Element>`                                               | Attach to your rendered cell's DOM node to enable dynamic measurement — see [Example 2](#example-2-dynamic-sizing-with-measureelement) and [Gotchas](#gotchas--edge-cases). No-op when both `estimateRowHeight` and `estimateColumnWidth` are plain numbers. |

## Advanced Usage & Examples

### Example 1: Basic Fixed-Size Grid

The foundational pattern — a scroll container sized to `totalWidth x totalHeight`, with cells absolutely positioned by `top`/`left`.

```tsx
import { useRef } from "react";
import { useVirtualGrid } from "@himanshu-sorathiya/react-kit/performance";

function Spreadsheet({ rows, cols, data }: { rows: number; cols: number; data: string[][] }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { virtualCells, totalHeight, totalWidth } = useVirtualGrid({
		rowCount: rows,
		colCount: cols,
		estimateRowHeight: 32,
		estimateColumnWidth: 120,
		getScrollElement: () => scrollRef.current,
	});

	return (
		<div ref={scrollRef} style={{ height: 500, overflow: "auto" }}>
			<div style={{ height: totalHeight, width: totalWidth, position: "relative" }}>
				{virtualCells.map((cell) => (
					<div
						key={cell.key}
						style={{
							position: "absolute",
							top: cell.top,
							left: cell.left,
							height: cell.height,
							width: cell.width,
						}}
					>
						{data[cell.rowIndex][cell.colIndex]}
					</div>
				))}
			</div>
		</div>
	);
}
```

### Example 2: Dynamic Sizing with `measureElement`

Both axes refine independently: a row's height tracks the tallest currently-measured cell in that row, a column's width tracks the widest currently-measured cell in that column.

```tsx
import { useRef } from "react";
import { useVirtualGrid } from "@himanshu-sorathiya/react-kit/performance";

function DataTable({ rows, cols, data }: { rows: number; cols: number; data: string[][] }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { virtualCells, totalHeight, totalWidth, measureElement } = useVirtualGrid({
		rowCount: rows,
		colCount: cols,
		estimateRowHeight: () => 32, // rough guess; refined per-row after first render
		estimateColumnWidth: () => 120,
		getScrollElement: () => scrollRef.current,
	});

	return (
		<div ref={scrollRef} style={{ height: 500, overflow: "auto" }}>
			<div style={{ height: totalHeight, width: totalWidth, position: "relative" }}>
				{virtualCells.map((cell) => (
					<div
						key={cell.key}
						ref={measureElement}
						data-row-index={cell.rowIndex}
						data-col-index={cell.colIndex}
						style={{ position: "absolute", top: cell.top, left: cell.left }}
					>
						{data[cell.rowIndex][cell.colIndex]}
					</div>
				))}
			</div>
		</div>
	);
}
```

### Example 3: Keyboard Navigation with `scrollToCell`

A spreadsheet-style "selected cell" that stays scrolled into view as arrow keys move the selection.

```tsx
import { useRef, useState } from "react";
import { useVirtualGrid } from "@himanshu-sorathiya/react-kit/performance";

function SelectableGrid({ rows, cols }: { rows: number; cols: number }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [selected, setSelected] = useState({ row: 0, col: 0 });

	const { virtualCells, totalHeight, totalWidth, scrollToCell } = useVirtualGrid({
		rowCount: rows,
		colCount: cols,
		estimateRowHeight: 28,
		estimateColumnWidth: 100,
		getScrollElement: () => scrollRef.current,
	});

	function moveSelection(deltaRow: number, deltaCol: number) {
		const next = {
			row: Math.max(0, Math.min(rows - 1, selected.row + deltaRow)),
			col: Math.max(0, Math.min(cols - 1, selected.col + deltaCol)),
		};
		setSelected(next);
		scrollToCell(next.row, next.col, { rowAlign: "auto", colAlign: "auto" });
	}

	return (
		<div
			ref={scrollRef}
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "ArrowDown") moveSelection(1, 0);
				if (e.key === "ArrowUp") moveSelection(-1, 0);
				if (e.key === "ArrowRight") moveSelection(0, 1);
				if (e.key === "ArrowLeft") moveSelection(0, -1);
			}}
			style={{ height: 400, overflow: "auto" }}
		>
			<div style={{ height: totalHeight, width: totalWidth, position: "relative" }}>
				{virtualCells.map((cell) => (
					<div
						key={cell.key}
						style={{
							position: "absolute",
							top: cell.top,
							left: cell.left,
							height: cell.height,
							width: cell.width,
							outline:
								cell.rowIndex === selected.row && cell.colIndex === selected.col
									? "2px solid blue"
									: undefined,
						}}
					/>
				))}
			</div>
		</div>
	);
}
```

## Real-World Use Cases

- Spreadsheets and data-entry grids
- Data tables with many rows and many columns (logs, admin panels, financial data)
- Calendar/scheduling grids (time slots x days)
- Photo or media grid galleries
- Heatmap visualizations
- Seating charts or floor-plan selectors
- Tile-based canvases (game boards, pixel editors)

## Gotchas & Edge Cases

- **There's no `reverse` option.** Unlike `useVirtualList`, grids don't support reversed axes here — this is a deliberate scope decision, not an oversight.
- **`measureElement` needs both `data-row-index` and `data-col-index`** on the element it's attached to, and works best passed directly as `ref={measureElement}` rather than wrapped in an inline arrow function, for the same referential-stability reason as `useVirtualList`.
- **A row's height is the max of its currently-measured cells' heights (and likewise for column width) — not "whichever cell was measured most recently."** If the tallest cell in a row later shrinks (e.g. its content collapses), the row's height correctly shrinks back down to the next-tallest currently-measured cell, rather than staying stuck at the old maximum.
- **Function `estimateRowHeight`/`estimateColumnWidth` should be memoized**, same reasoning as `useVirtualList`'s `estimateSize` — an inline function rebuilds the relevant internal size cache every render.
- **`pauseWhenOffscreen` has no effect when `getScrollElement` returns `window`/`document`.**
- **`isRtl` uses the modern (negative `scrollLeft`) RTL convention**, not exhaustively cross-browser verified — same caveat as `useVirtualList`.
- **`itemKey` here is function-only** — there's no string/string-array "data path" form like `useVirtualList` has, since a grid cell's identity is naturally `(rowIndex, colIndex)` rather than tied to one flat data array.
- **`scrollingDelay: 0` doesn't disable `isScrolling` tracking** — it resolves immediately instead of after a delay.
- **`VirtualCell.top`/`.left` exclude `scrollMarginTop`/`scrollMarginLeft`** — they're relative to the virtualized content itself, not the page.
- **SSR is safe by construction**, same reasoning as `useVirtualList` — `getScrollElement` naturally returns `null` server-side and pre-hydration, so output matches on both.

## See Also

- [`useVirtualList`](../useVirtualList/README.md) — the 1D (list) counterpart to this hook.
- [`useResizeObserver`](../useResizeObserver/README.md) — used internally to track the scroll container's viewport size, and (via the native `ResizeObserver` API directly) to power `measureElement`.
- [`useIntersectionObserver`](../useIntersectionObserver/README.md) — used internally to power `pauseWhenOffscreen`.
- [`useMutationObserver`](../useMutationObserver/README.md) — not used internally; see its own README for why `ResizeObserver` is the better fit for size tracking specifically.
