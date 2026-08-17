import type {
	ScrollAlign,
	ScrollToOffsetOptions,
} from "../../shared/virtualShared/types.ts";

/** Options for {@link useVirtualGrid}'s `scrollToCell` method. */
interface ScrollToCellOptions {
	/**
	 * How to position the target row within the viewport.
	 *
	 * @defaultValue `"auto"`
	 */
	rowAlign?: ScrollAlign;

	/**
	 * How to position the target column within the viewport.
	 *
	 * @defaultValue `"auto"`
	 */
	colAlign?: ScrollAlign;

	/**
	 * Use smooth (animated) scrolling instead of an instant jump.
	 *
	 * @defaultValue `false`
	 */
	smooth?: boolean;
}

/** Options for {@link useVirtualGrid}'s `scrollToRow` method. */
interface ScrollToRowOptions {
	/**
	 * How to position the target row within the viewport.
	 *
	 * @defaultValue `"auto"`
	 */
	align?: ScrollAlign;

	/**
	 * Use smooth (animated) scrolling instead of an instant jump.
	 *
	 * @defaultValue `false`
	 */
	smooth?: boolean;
}

/** Options for {@link useVirtualGrid}'s `scrollToColumn` method. */
interface ScrollToColumnOptions {
	/**
	 * How to position the target column within the viewport.
	 *
	 * @defaultValue `"auto"`
	 */
	align?: ScrollAlign;

	/**
	 * Use smooth (animated) scrolling instead of an instant jump.
	 *
	 * @defaultValue `false`
	 */
	smooth?: boolean;
}

/** A single rendered cell, as produced by {@link useVirtualGrid}'s `virtualCells`. */
interface VirtualCell {
	/**
	 * A stable React key for this cell - derived from `itemKey` if
	 * provided, otherwise `` `${rowIndex}:${colIndex}` ``.
	 */
	key: string | number;

	/** This cell's row position in the full (un-virtualized) grid. */
	rowIndex: number;

	/** This cell's column position in the full (un-virtualized) grid. */
	colIndex: number;

	/** This cell's row height - the max measured height among its row's currently-tracked cells, if `measureElement` is in use. */
	height: number;

	/** This cell's column width - the max measured width among its column's currently-tracked cells, if `measureElement` is in use. */
	width: number;

	/** This cell's top position, relative to the top of the virtualized content (i.e. excluding `scrollMarginTop`). */
	top: number;

	/** This cell's left position, relative to the left of the virtualized content (i.e. excluding `scrollMarginLeft`). */
	left: number;

	/** `top + height` - this cell's bottom position, provided for convenience. */
	bottom: number;

	/** `left + width` - this cell's right position, provided for convenience. */
	right: number;
}

/** The currently-rendered row/column index ranges, as produced by {@link useVirtualGrid}'s `onRangeChange`. */
interface VirtualGridRange {
	/** Numerically lowest rendered row index (inclusive), overscan included. */
	rowStartIndex: number;
	/** Numerically highest rendered row index (inclusive), overscan included. */
	rowEndIndex: number;
	/** Numerically lowest rendered column index (inclusive), overscan included. */
	colStartIndex: number;
	/** Numerically highest rendered column index (inclusive), overscan included. */
	colEndIndex: number;
}

/** Customizes what "visible" means for the `pauseWhenOffscreen` option - see {@link UseVirtualGridOptions.pauseWhenOffscreen}. */
interface PauseWhenOffscreenConfig {
	/**
	 * The element used as the viewport when checking whether the scroll
	 * container is visible.
	 *
	 * @defaultValue `null` (the nearest scrollable ancestor / browser viewport, per `IntersectionObserver`'s native `root` behavior)
	 */
	root?: Element | Document | null;

	/**
	 * Margin added around `root`'s bounding box before checking visibility,
	 * in CSS `margin` shorthand syntax.
	 *
	 * @defaultValue `"0px"`
	 */
	rootMargin?: string;
}

/** Options for {@link useVirtualGrid}. */
interface UseVirtualGridOptions {
	/** Total number of rows in the full (un-virtualized) grid. */
	rowCount: number;

	/** Total number of columns in the full (un-virtualized) grid. */
	colCount: number;

	/**
	 * Each row's height - a constant applied to every row, or a function
	 * called per row index.
	 *
	 * @remarks
	 * When a function is used and `measureElement` isn't attached to your
	 * rendered cells, this is treated as a fixed height (not just an
	 * initial estimate). A function here is memoized internally keyed on
	 * its own reference identity - see the equivalent note on
	 * {@link estimateColumnWidth}, which applies the same way to this field.
	 */
	estimateRowHeight: number | ((rowIndex: number) => number);

	/**
	 * Each column's width - a constant applied to every column, or a
	 * function called per column index.
	 *
	 * @remarks
	 * When a function is used and `measureElement` isn't attached to your
	 * rendered cells, this is treated as a fixed width (not just an
	 * initial estimate) - attach `measureElement` if you want actual
	 * rendered sizes to refine it over time.
	 *
	 * A function `estimateColumnWidth` (and likewise `estimateRowHeight`)
	 * is memoized internally keyed on its own reference identity - passing
	 * a new inline function every render rebuilds the entire internal size
	 * cache on every render, which defeats the point of caching. Memoize it
	 * if it's not already stable.
	 */
	estimateColumnWidth: number | ((colIndex: number) => number);

	/**
	 * Returns the scrollable element to track - called fresh on every
	 * render, so it's safe to pass e.g. `() => scrollRef.current` without
	 * memoizing it. Return `window` or `document` to virtualize within the
	 * whole page's own scroll, instead of a dedicated scrollable container.
	 */
	getScrollElement: () => HTMLElement | Window | Document | null;

	/**
	 * Extra rows rendered beyond each edge of the visible range, to reduce
	 * blank flashes during fast scrolling.
	 *
	 * @defaultValue `3`
	 */
	overscanRows?: number;

	/**
	 * Extra columns rendered beyond each edge of the visible range.
	 *
	 * @defaultValue `3`
	 */
	overscanCols?: number;

	/**
	 * Space between rows.
	 *
	 * @defaultValue `0`
	 */
	rowGap?: number;

	/**
	 * Space between columns.
	 *
	 * @defaultValue `0`
	 */
	columnGap?: number;

	/**
	 * Distance this grid's content starts from the top of a shared scroll
	 * container - e.g. page content above it when using Window/Document
	 * scrolling.
	 *
	 * @defaultValue `0`
	 */
	scrollMarginTop?: number;

	/**
	 * Distance this grid's content starts from the left of a shared scroll
	 * container.
	 *
	 * @defaultValue `0`
	 */
	scrollMarginLeft?: number;

	/**
	 * RTL horizontal scrolling (affects the column axis). Uses the modern
	 * (negative `scrollLeft`) convention - not cross-browser verified.
	 *
	 * @defaultValue `false`
	 */
	isRtl?: boolean;

	/**
	 * Pause scroll/resize tracking without unmounting. Virtual cells freeze
	 * at their last computed state rather than going blank.
	 *
	 * @defaultValue `true`
	 */
	enabled?: boolean;

	/**
	 * Also pause scroll/resize tracking whenever the scroll element itself
	 * isn't visible on screen - `true` for defaults, or a
	 * {@link PauseWhenOffscreenConfig} to customize the
	 * `IntersectionObserver` `root`/`rootMargin`. Has no effect when
	 * `getScrollElement` returns `Window`/`Document`, since a whole-page
	 * scroller has no meaningful "offscreen" state of its own.
	 *
	 * @defaultValue `false` (opt-in, since it adds an observer)
	 */
	pauseWhenOffscreen?: boolean | PauseWhenOffscreenConfig;

	/**
	 * How long scrolling must stay idle before `isScrolling` flips back to
	 * `false`. `0` (or any non-positive value) resolves `isScrolling` to
	 * `false` immediately, rather than disabling tracking altogether.
	 *
	 * @defaultValue `150`
	 */
	scrollingDelay?: number;

	/**
	 * Assumed viewport height before the scroll container has been
	 * measured.
	 *
	 * @defaultValue `0`
	 */
	initialViewportHeight?: number;

	/**
	 * Assumed viewport width before the scroll container has been
	 * measured.
	 *
	 * @defaultValue `0`
	 */
	initialViewportWidth?: number;

	/** Scroll to this vertical offset on mount, before the first paint. Takes priority over `initialScrollRow` if both are set. */
	initialScrollTop?: number;

	/** Scroll to this horizontal offset on mount, before the first paint. Takes priority over `initialScrollCol` if both are set. */
	initialScrollLeft?: number;

	/** Scroll so this row is visible on mount, before the first paint. Ignored if `initialScrollTop` is also set. */
	initialScrollRow?: number;

	/** Scroll so this column is visible on mount, before the first paint. Ignored if `initialScrollLeft` is also set. */
	initialScrollCol?: number;

	/**
	 * How `initialScrollRow` is aligned within the viewport. Only used
	 * together with `initialScrollRow`.
	 *
	 * @defaultValue `"start"`
	 */
	initialRowAlign?: ScrollAlign;

	/**
	 * How `initialScrollCol` is aligned within the viewport. Only used
	 * together with `initialScrollCol`.
	 *
	 * @defaultValue `"start"`
	 */
	initialColAlign?: ScrollAlign;

	/**
	 * When `measureElement` reports a size for a row/column positioned
	 * before the current viewport, adjust `scrollTop`/`scrollLeft` by the
	 * same delta so already-visible content doesn't visually jump.
	 *
	 * @defaultValue `true`
	 */
	adjustScrollOnMeasure?: boolean;

	/**
	 * Derives each rendered cell's React `key`. Falls back to
	 * `` `${rowIndex}:${colIndex}` `` if omitted.
	 */
	itemKey?: (rowIndex: number, colIndex: number) => string | number;

	/**
	 * Called whenever the rendered row or column index range actually
	 * changes (not on every render). Useful for analytics, or triggering
	 * data-fetching from outside the hook.
	 */
	onRangeChange?: (range: VirtualGridRange) => void;
}

export type {
	PauseWhenOffscreenConfig,
	ScrollAlign,
	ScrollToCellOptions,
	ScrollToColumnOptions,
	ScrollToOffsetOptions,
	ScrollToRowOptions,
	UseVirtualGridOptions,
	VirtualCell,
	VirtualGridRange,
};
