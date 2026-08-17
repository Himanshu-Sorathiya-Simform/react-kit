import {
	type RefCallback,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useEventListener } from "../../events/useEventListener/useEventListener.ts";
import type { Axis } from "../../shared/virtualShared/types.ts";
import { useDebouncedCallback } from "../useDebouncer/useDebouncedCallback.ts";
import { useIntersectionObserver } from "../useIntersectionObserver/useIntersectionObserver.ts";
import { useResizeObserver } from "../useResizeObserver/useResizeObserver.ts";
import {
	DEFAULT_OVERSCAN_COLS,
	DEFAULT_OVERSCAN_ROWS,
	SCROLLING_DEBOUNCE_MS,
} from "./constants.ts";
import type {
	ScrollToCellOptions,
	ScrollToColumnOptions,
	ScrollToOffsetOptions,
	ScrollToRowOptions,
	UseVirtualGridOptions,
	VirtualCell,
	VirtualGridRange,
} from "./types.ts";
import {
	calcAxisRange,
	calcScrollToAxisOffset,
	getScrollElementOffset,
	getScrollElementSize,
	getSizeAtIndex,
	getStartOffset,
	getTotalSize,
	OffsetCache,
	resolveScrollElement,
} from "./utils.ts";

/** Return value of {@link useVirtualGrid}. */
interface UseVirtualGridReturn {
	/** The currently-rendered cells (visible rows x visible columns, plus overscan), each with a computed size/position. Render these, not the full `rowCount` x `colCount`. */
	virtualCells: VirtualCell[];
	/** Total height of all rows plus row gaps - set this as the virtualized container's height so the vertical scrollbar is sized correctly. */
	totalHeight: number;
	/** Total width of all columns plus column gaps - set this as the virtualized container's width so the horizontal scrollbar is sized correctly. */
	totalWidth: number;
	/** Whether the grid is currently scrolling, per `scrollingDelay`. Useful for cheaper rendering while actively scrolling. */
	isScrolling: boolean;
	/** Imperatively scrolls so the given cell is visible on both axes, per the requested {@link ScrollToCellOptions}. Stable across renders. */
	scrollToCell: (
		rowIndex: number,
		colIndex: number,
		options?: ScrollToCellOptions,
	) => void;
	/** Imperatively scrolls to exact top/left offsets, each clamped into range. Stable across renders. */
	scrollToOffset: (
		offsets: { top: number; left: number },
		options?: ScrollToOffsetOptions,
	) => void;
	/** Imperatively scrolls so the given row is visible, leaving the horizontal scroll position untouched. Stable across renders. */
	scrollToRow: (rowIndex: number, options?: ScrollToRowOptions) => void;
	/** Imperatively scrolls so the given column is visible, leaving the vertical scroll position untouched. Stable across renders. */
	scrollToColumn: (colIndex: number, options?: ScrollToColumnOptions) => void;
	/**
	 * Attach to your rendered cell's DOM node to enable dynamic measurement:
	 * `<div ref={measureElement} data-row-index={cell.rowIndex} data-col-index={cell.colIndex}>`.
	 * Row height is taken as the max measured height among that row's
	 * currently-tracked cells (and likewise column width); reads indices
	 * from data attributes (rather than taking them as parameters) so this
	 * stays referentially stable and can be passed directly as `ref`.
	 * No-op when both estimateRowHeight and estimateColumnWidth are plain
	 * numbers (nothing to refine).
	 */
	measureElement: RefCallback<Element>;
}

/** A row's or column's visible index range, before overscan. */
interface AxisRange {
	startIndex: number;
	endIndex: number;
}

/** Coerces to a non-negative integer, treating `NaN`/`Infinity`/negatives as `0` rather than propagating them into array sizes or layout math. */
function safeInt(value: number): number {
	return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** Same as {@link safeInt} but preserves fractional values (for sizes/gaps/margins, not just counts). `undefined` also becomes `0`. */
function safeNonNegative(value: number | undefined): number {
	return value !== undefined && Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Raw DOM `scrollTop`/`scrollLeft` -> effective offset along `axis`:
 * normalizes away `scrollMargin` (subtracted) and RTL's negative-`scrollLeft`
 * convention (absolute-valued, horizontal axis only), so the rest of this
 * hook can work in one consistent, always-non-negative coordinate space per
 * axis.
 */
function readEffectiveScrollOffset(
	scrollEl: HTMLElement | Window | Document,
	axis: Axis,
	isRtl: boolean,
	scrollMargin: number,
): number {
	const raw = getScrollElementOffset(scrollEl, axis);
	const rtlAdjusted = isRtl && axis === "horizontal" ? Math.abs(raw) : raw;

	return Math.max(0, rtlAdjusted - scrollMargin);
}

/** Inverse of {@link readEffectiveScrollOffset}: effective offset -> the raw value to hand to `Element.scrollTo`. */
function toRawScrollValue(
	effectiveOffset: number,
	axis: Axis,
	isRtl: boolean,
	scrollMargin: number,
): number {
	const withMargin = effectiveOffset + scrollMargin;

	return isRtl && axis === "horizontal" ? -withMargin : withMargin;
}

/** Largest value currently tracked in a non-empty map, or `undefined` if empty - used to derive a row's height (or column's width) from its currently-measured cells. */
function maxOf(map: Map<number, number>): number | undefined {
	let max: number | undefined;

	for (const value of map.values()) {
		if (max === undefined || value > max) max = value;
	}

	return max;
}

/**
 * Renders only the cells currently visible in a scrollable container (plus
 * a small overscan buffer on each axis), instead of the full
 * `rowCount` x `colCount` grid - keeps DOM node count roughly constant
 * regardless of how large the grid is.
 *
 * @remarks
 * Core behavior comes from `rowCount`/`colCount` + `estimateRowHeight`/
 * `estimateColumnWidth` + `getScrollElement`; everything else in
 * {@link UseVirtualGridOptions} is opt-in on top of that: `isRtl` for the
 * column axis's direction, `rowGap`/`columnGap`/`scrollMarginTop`/
 * `scrollMarginLeft` for layout details, `measureElement` (returned) for
 * refining both estimate functions with real rendered sizes (a row's
 * height becomes the max measured height among its currently-tracked
 * cells, and likewise for column width), `pauseWhenOffscreen`/`enabled`
 * for pausing tracking when inactive, and `initialScrollRow`/
 * `initialScrollCol`/`initialScrollTop`/`initialScrollLeft` for where to
 * start scrolled to. There's no `reverse` layout option here, unlike
 * {@link useVirtualList} - grids don't support reversed axes.
 *
 * `estimateRowHeight`/`estimateColumnWidth`, when functions, should be
 * memoized (stable across renders) - see the note on
 * {@link UseVirtualGridOptions.estimateColumnWidth} for why.
 *
 * @param options - See {@link UseVirtualGridOptions}.
 * @returns See {@link UseVirtualGridReturn}.
 *
 * @example
 * Fixed-size grid:
 * ```tsx
 * function Grid({ rows, cols }: { rows: number; cols: number }) {
 *   const scrollRef = useRef<HTMLDivElement>(null);
 *   const { virtualCells, totalHeight, totalWidth } = useVirtualGrid({
 *     rowCount: rows,
 *     colCount: cols,
 *     estimateRowHeight: 32,
 *     estimateColumnWidth: 120,
 *     getScrollElement: () => scrollRef.current,
 *   });
 *
 *   return (
 *     <div ref={scrollRef} style={{ height: 400, overflow: "auto" }}>
 *       <div style={{ height: totalHeight, width: totalWidth, position: "relative" }}>
 *         {virtualCells.map((cell) => (
 *           <div
 *             key={cell.key}
 *             style={{ position: "absolute", top: cell.top, left: cell.left, height: cell.height, width: cell.width }}
 *           >
 *             {cell.rowIndex},{cell.colIndex}
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * Variable-size cells, refined by real measurements:
 * ```tsx
 * const { virtualCells, measureElement } = useVirtualGrid({
 *   rowCount: rows,
 *   colCount: cols,
 *   estimateRowHeight: () => 32, // rough guess
 *   estimateColumnWidth: () => 120,
 *   getScrollElement: () => scrollRef.current,
 * });
 * // in the cell: <div ref={measureElement} data-row-index={cell.rowIndex} data-col-index={cell.colIndex}>...
 * ```
 */
function useVirtualGrid(options: UseVirtualGridOptions): UseVirtualGridReturn {
	const {
		rowCount,
		colCount,
		estimateRowHeight,
		estimateColumnWidth,
		getScrollElement,
		overscanRows = DEFAULT_OVERSCAN_ROWS,
		overscanCols = DEFAULT_OVERSCAN_COLS,
		rowGap = 0,
		columnGap = 0,
		scrollMarginTop = 0,
		scrollMarginLeft = 0,
		isRtl = false,
		enabled = true,
		pauseWhenOffscreen = false,
		scrollingDelay = SCROLLING_DEBOUNCE_MS,
		initialViewportHeight = 0,
		initialViewportWidth = 0,
		initialScrollTop,
		initialScrollLeft,
		initialScrollRow,
		initialScrollCol,
		initialRowAlign = "start",
		initialColAlign = "start",
		itemKey,
	} = options;
	// adjustScrollOnMeasure and onRangeChange are intentionally not
	// destructured - both are only ever read via optionsRef.current, so a
	// later change to either takes effect immediately without needing to be
	// threaded through as an effect dependency.

	const safeRowCount = safeInt(rowCount);
	const safeColCount = safeInt(colCount);
	const safeOverscanRows = safeInt(overscanRows);
	const safeOverscanCols = safeInt(overscanCols);
	const safeRowGap = safeNonNegative(rowGap);
	const safeColumnGap = safeNonNegative(columnGap);
	const safeScrollMarginTop = safeNonNegative(scrollMarginTop);
	const safeScrollMarginLeft = safeNonNegative(scrollMarginLeft);

	// scrollToRow/scrollToColumn/scrollToCell/scrollToOffset/measureElement
	// are returned to the consumer to call whenever they like, so they can't
	// be built with useEffectEvent (Effect Events may only be called from
	// this hook's own effects, never handed out -
	// react.dev/reference/react/useEffectEvent#caveats). The ref-for-latest-
	// values pattern is the correct tool for a stable, publicly-exposed
	// imperative callback.
	const optionsRef = useRef(options);

	useLayoutEffect(() => {
		optionsRef.current = options;
	});

	const rowCache = useMemo(() => {
		if (typeof estimateRowHeight !== "function") return undefined;

		const cache = new OffsetCache();
		cache.initializeOffsets(safeRowCount, estimateRowHeight, safeRowGap);

		return cache;
	}, [safeRowCount, estimateRowHeight, safeRowGap]);

	const colCache = useMemo(() => {
		if (typeof estimateColumnWidth !== "function") return undefined;

		const cache = new OffsetCache();
		cache.initializeOffsets(safeColCount, estimateColumnWidth, safeColumnGap);

		return cache;
	}, [safeColCount, estimateColumnWidth, safeColumnGap]);

	const rowCacheRef = useRef(rowCache);
	const colCacheRef = useRef(colCache);

	useLayoutEffect(() => {
		rowCacheRef.current = rowCache;
	}, [rowCache]);

	useLayoutEffect(() => {
		colCacheRef.current = colCache;
	}, [colCache]);

	const [scrollTop, setScrollTop] = useState(() => {
		if (typeof initialScrollTop === "number") {
			return Math.max(0, initialScrollTop);
		}

		if (typeof initialScrollRow === "number" && safeRowCount > 0) {
			const safeIdx = Math.max(
				0,
				Math.min(safeInt(initialScrollRow), safeRowCount - 1),
			);
			const total = getTotalSize(
				safeRowCount,
				estimateRowHeight,
				rowCache,
				safeRowGap,
			);

			return calcScrollToAxisOffset(
				safeIdx,
				initialRowAlign,
				initialViewportHeight,
				total,
				0,
				estimateRowHeight,
				rowCache,
				safeRowGap,
			);
		}

		return 0;
	});

	const [scrollLeft, setScrollLeft] = useState(() => {
		if (typeof initialScrollLeft === "number") {
			return Math.max(0, initialScrollLeft);
		}

		if (typeof initialScrollCol === "number" && safeColCount > 0) {
			const safeIdx = Math.max(
				0,
				Math.min(safeInt(initialScrollCol), safeColCount - 1),
			);
			const total = getTotalSize(
				safeColCount,
				estimateColumnWidth,
				colCache,
				safeColumnGap,
			);

			return calcScrollToAxisOffset(
				safeIdx,
				initialColAlign,
				initialViewportWidth,
				total,
				0,
				estimateColumnWidth,
				colCache,
				safeColumnGap,
			);
		}

		return 0;
	});

	const [isScrolling, setIsScrolling] = useState(false);
	// Bumped only when a row/col OffsetCache is mutated in place by a
	// measurement and nothing else (like setScrollTop/setScrollLeft) already
	// forced a re-render for it.
	const [, setMeasurementVersion] = useState(0);
	const initialScrollMounted = useRef(false);

	const { debouncedFunc: resetIsScrolling } = useDebouncedCallback(
		() => setIsScrolling(false),
		scrollingDelay,
	);

	const scrollEl = getScrollElement();

	// useLayoutEffect (not useEffect): applying the initial scroll position
	// must happen before paint, or there's a visible one-frame flash at
	// scrollTop/scrollLeft 0 before it jumps to the intended position.
	useLayoutEffect(() => {
		if (!scrollEl) return;

		if (!initialScrollMounted.current) {
			initialScrollMounted.current = true;

			const hasInitialTop =
				typeof initialScrollTop === "number"
				|| typeof initialScrollRow === "number";
			const hasInitialLeft =
				typeof initialScrollLeft === "number"
				|| typeof initialScrollCol === "number";

			if (hasInitialTop || hasInitialLeft) {
				const resolvedEl = resolveScrollElement(scrollEl);

				if (resolvedEl) {
					const scrollToOpts: ScrollToOptions = { behavior: "auto" };

					if (hasInitialTop) {
						scrollToOpts.top = toRawScrollValue(
							scrollTop,
							"vertical",
							isRtl,
							safeScrollMarginTop,
						);
					}

					if (hasInitialLeft) {
						scrollToOpts.left = toRawScrollValue(
							scrollLeft,
							"horizontal",
							isRtl,
							safeScrollMarginLeft,
						);
					}

					resolvedEl.scrollTo(scrollToOpts);
				}

				return;
			}
		}

		const effectiveTop = readEffectiveScrollOffset(
			scrollEl,
			"vertical",
			isRtl,
			safeScrollMarginTop,
		);
		const effectiveLeft = readEffectiveScrollOffset(
			scrollEl,
			"horizontal",
			isRtl,
			safeScrollMarginLeft,
		);

		setScrollTop((prev) => (prev === effectiveTop ? prev : effectiveTop));
		setScrollLeft((prev) => (prev === effectiveLeft ? prev : effectiveLeft));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scrollEl, isRtl, safeScrollMarginTop, safeScrollMarginLeft]);

	function handleScroll() {
		const { getScrollElement, isRtl, scrollMarginTop, scrollMarginLeft } =
			optionsRef.current;

		const scrollEl = getScrollElement();

		if (!scrollEl) return;

		const effectiveTop = readEffectiveScrollOffset(
			scrollEl,
			"vertical",
			isRtl ?? false,
			safeNonNegative(scrollMarginTop),
		);
		const effectiveLeft = readEffectiveScrollOffset(
			scrollEl,
			"horizontal",
			isRtl ?? false,
			safeNonNegative(scrollMarginLeft),
		);

		setScrollTop(effectiveTop);
		setScrollLeft(effectiveLeft);
		setIsScrolling(true);
		resetIsScrolling();
	}

	// --- Optional: pause tracking entirely when offscreen ------------------

	const pauseConfig =
		pauseWhenOffscreen === false ? null
		: pauseWhenOffscreen === true ? {}
		: pauseWhenOffscreen;

	function getVisibilityTarget(): Element | null {
		const el = getScrollElement();

		return el instanceof Window || el instanceof Document ? null : el;
	}

	const { isIntersecting: scrollElVisible } = useIntersectionObserver({
		target: getVisibilityTarget,
		enabled: pauseConfig !== null,
		root: pauseConfig?.root,
		rootMargin: pauseConfig?.rootMargin,
		initialIsIntersecting: true,
	});

	const effectiveEnabled = enabled && (pauseConfig === null || scrollElVisible);

	useEventListener("scroll", handleScroll, {
		// Assumes useEventListener treats a null target as "don't attach" -
		// worth confirming against its actual implementation.
		target: effectiveEnabled ? scrollEl : null,
		passive: true,
	});

	const { width: observedWidth, height: observedHeight } = useResizeObserver({
		target: getScrollElement,
		enabled: effectiveEnabled,
	});

	const scrollElHeight = observedHeight || initialViewportHeight;
	const scrollElWidth = observedWidth || initialViewportWidth;

	const totalHeight = getTotalSize(
		safeRowCount,
		estimateRowHeight,
		rowCache,
		safeRowGap,
	);
	const totalWidth = getTotalSize(
		safeColCount,
		estimateColumnWidth,
		colCache,
		safeColumnGap,
	);

	const { startIndex: rowStart, endIndex: rowEnd } = calcAxisRange(
		scrollTop,
		scrollElHeight,
		safeRowCount,
		estimateRowHeight,
		safeOverscanRows,
		rowCache,
		safeRowGap,
	);

	const { startIndex: colStart, endIndex: colEnd } = calcAxisRange(
		scrollLeft,
		scrollElWidth,
		safeColCount,
		estimateColumnWidth,
		safeOverscanCols,
		colCache,
		safeColumnGap,
	);

	const virtualCells: VirtualCell[] = [];

	if (rowStart <= rowEnd && colStart <= colEnd) {
		let cumulativeTop =
			rowCache ?
				rowCache.getItemStartOffset(rowStart)
			:	getStartOffset(rowStart, estimateRowHeight, undefined, safeRowGap);

		for (let r = rowStart; r <= rowEnd; r++) {
			const rowHeight =
				rowCache ?
					rowCache.getItemSize(r)
				:	getSizeAtIndex(r, estimateRowHeight);
			const bottom = cumulativeTop + rowHeight;

			let cumulativeLeft =
				colCache ?
					colCache.getItemStartOffset(colStart)
				:	getStartOffset(
						colStart,
						estimateColumnWidth,
						undefined,
						safeColumnGap,
					);

			for (let c = colStart; c <= colEnd; c++) {
				const colWidth =
					colCache ?
						colCache.getItemSize(c)
					:	getSizeAtIndex(c, estimateColumnWidth);
				const right = cumulativeLeft + colWidth;

				const key: string | number = itemKey ? itemKey(r, c) : `${r}:${c}`;

				virtualCells.push({
					key,
					rowIndex: r,
					colIndex: c,
					height: rowHeight,
					width: colWidth,
					top: cumulativeTop,
					left: cumulativeLeft,
					bottom,
					right,
				});

				cumulativeLeft +=
					colWidth + (c < safeColCount - 1 ? safeColumnGap : 0);
			}

			cumulativeTop += rowHeight + (r < safeRowCount - 1 ? safeRowGap : 0);
		}
	}

	// --- Dynamic measurement (measureElement) -------------------------------
	//
	// Row height is the max measured height among that row's currently-
	// tracked cells (and likewise column width), not just "whatever the last
	// measured cell reported" - otherwise a row would never be able to
	// shrink back down after its tallest cell's content shrinks, only grow.

	const pendingRowMeasurementsRef = useRef<Map<number, number>>(new Map());
	const pendingColMeasurementsRef = useRef<Map<number, number>>(new Map());
	const rowCellHeightsRef = useRef<Map<number, Map<number, number>>>(new Map());
	const colCellWidthsRef = useRef<Map<number, Map<number, number>>>(new Map());
	const elementCellMapRef = useRef<WeakMap<Element, { row: number; col: number }>>(
		new WeakMap(),
	);
	const sharedObserverRef = useRef<ResizeObserver | null>(null);
	// Range as of the last commit, used as the "already stable, don't let it
	// jump" reference for scroll-anchoring - deliberately updated *after*
	// flushPendingMeasurements runs (see effect ordering below).
	const lastRowRangeRef = useRef<AxisRange>({
		startIndex: rowStart,
		endIndex: rowEnd,
	});
	const lastColRangeRef = useRef<AxisRange>({
		startIndex: colStart,
		endIndex: colEnd,
	});

	useEffect(() => {
		return () => {
			sharedObserverRef.current?.disconnect();
			sharedObserverRef.current = null;
		};
	}, []);

	function recordCellMeasurement(row: number, col: number, element: Element) {
		const rect = element.getBoundingClientRect();

		let rowMap = rowCellHeightsRef.current.get(row);

		if (!rowMap) {
			rowMap = new Map();
			rowCellHeightsRef.current.set(row, rowMap);
		}

		rowMap.set(col, rect.height);

		let colMap = colCellWidthsRef.current.get(col);

		if (!colMap) {
			colMap = new Map();
			colCellWidthsRef.current.set(col, colMap);
		}

		colMap.set(row, rect.width);

		const newRowHeight = maxOf(rowMap);
		const newColWidth = maxOf(colMap);

		if (newRowHeight !== undefined)
			pendingRowMeasurementsRef.current.set(row, newRowHeight);
		if (newColWidth !== undefined)
			pendingColMeasurementsRef.current.set(col, newColWidth);
	}

	function removeCellMeasurement(row: number, col: number) {
		const rowMap = rowCellHeightsRef.current.get(row);

		if (rowMap) {
			rowMap.delete(col);

			if (rowMap.size === 0) {
				rowCellHeightsRef.current.delete(row);
				// No cells left to measure this row by - leave the cache's
				// current row height alone rather than reverting to the raw
				// estimate, which would cause an unwanted jump.
			} else {
				const newRowHeight = maxOf(rowMap);

				if (newRowHeight !== undefined) {
					pendingRowMeasurementsRef.current.set(row, newRowHeight);
				}
			}
		}

		const colMap = colCellWidthsRef.current.get(col);

		if (colMap) {
			colMap.delete(row);

			if (colMap.size === 0) {
				colCellWidthsRef.current.delete(col);
			} else {
				const newColWidth = maxOf(colMap);

				if (newColWidth !== undefined) {
					pendingColMeasurementsRef.current.set(col, newColWidth);
				}
			}
		}
	}

	function applyAxisCompensation(
		pending: Map<number, number>,
		cache: OffsetCache | undefined,
		range: AxisRange,
	): number {
		if (pending.size === 0 || !cache) return 0;

		let compensation = 0;

		for (const [index, newSize] of pending) {
			if (index < range.startIndex) {
				compensation += newSize - cache.getItemSize(index);
			}
		}

		return compensation;
	}

	function flushPendingMeasurements() {
		const hasRowUpdates = pendingRowMeasurementsRef.current.size > 0;
		const hasColUpdates = pendingColMeasurementsRef.current.size > 0;

		if (!hasRowUpdates && !hasColUpdates) return;

		const rowCompensation = applyAxisCompensation(
			pendingRowMeasurementsRef.current,
			rowCacheRef.current,
			lastRowRangeRef.current,
		);
		const colCompensation = applyAxisCompensation(
			pendingColMeasurementsRef.current,
			colCacheRef.current,
			lastColRangeRef.current,
		);

		let rowChanged = false;
		let colChanged = false;

		if (rowCacheRef.current && hasRowUpdates) {
			rowChanged = rowCacheRef.current.applyMeasurements(
				pendingRowMeasurementsRef.current,
			);
		}

		if (colCacheRef.current && hasColUpdates) {
			colChanged = colCacheRef.current.applyMeasurements(
				pendingColMeasurementsRef.current,
			);
		}

		pendingRowMeasurementsRef.current.clear();
		pendingColMeasurementsRef.current.clear();

		const shouldAdjust = optionsRef.current.adjustScrollOnMeasure ?? true;

		if (shouldAdjust && (rowCompensation !== 0 || colCompensation !== 0)) {
			const currentScrollEl = optionsRef.current.getScrollElement();
			const isRtlValue = optionsRef.current.isRtl ?? false;
			const marginTop = safeNonNegative(optionsRef.current.scrollMarginTop);
			const marginLeft = safeNonNegative(optionsRef.current.scrollMarginLeft);

			if (currentScrollEl) {
				const resolvedEl = resolveScrollElement(currentScrollEl);
				const scrollToOpts: ScrollToOptions = { behavior: "auto" };
				let nextTop: number | undefined;
				let nextLeft: number | undefined;

				if (rowCompensation !== 0) {
					const currentEffective = readEffectiveScrollOffset(
						currentScrollEl,
						"vertical",
						isRtlValue,
						marginTop,
					);

					nextTop = Math.max(0, currentEffective + rowCompensation);
					scrollToOpts.top = toRawScrollValue(
						nextTop,
						"vertical",
						isRtlValue,
						marginTop,
					);
				}

				if (colCompensation !== 0) {
					const currentEffective = readEffectiveScrollOffset(
						currentScrollEl,
						"horizontal",
						isRtlValue,
						marginLeft,
					);

					nextLeft = Math.max(0, currentEffective + colCompensation);
					scrollToOpts.left = toRawScrollValue(
						nextLeft,
						"horizontal",
						isRtlValue,
						marginLeft,
					);
				}

				if (resolvedEl) {
					resolvedEl.scrollTo(scrollToOpts);
				}

				if (nextTop !== undefined) setScrollTop(nextTop);
				if (nextLeft !== undefined) setScrollLeft(nextLeft);

				return;
			}
		}

		if (rowChanged || colChanged) {
			setMeasurementVersion((v) => v + 1);
		}
	}

	function getOrCreateSharedObserver(): ResizeObserver | null {
		if (sharedObserverRef.current) return sharedObserverRef.current;
		if (typeof ResizeObserver === "undefined") return null;

		sharedObserverRef.current = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const cell = elementCellMapRef.current.get(entry.target);

				if (!cell) continue;

				recordCellMeasurement(cell.row, cell.col, entry.target);
			}

			flushPendingMeasurements();
		});

		return sharedObserverRef.current;
	}

	const measureElement = useCallback<RefCallback<Element>>((element) => {
		if (!element) return;

		// Read fresh, not any outer destructured value - this closure is
		// frozen at first render (see the eslint-disable below).
		const { estimateRowHeight, estimateColumnWidth } = optionsRef.current;

		if (
			typeof estimateRowHeight !== "function"
			&& typeof estimateColumnWidth !== "function"
		) {
			return; // both axes fixed-size: nothing to refine
		}

		const rowAttr = element.getAttribute("data-row-index");
		const colAttr = element.getAttribute("data-col-index");
		const row = rowAttr !== null ? Number(rowAttr) : NaN;
		const col = colAttr !== null ? Number(colAttr) : NaN;

		if (!Number.isFinite(row) || !Number.isFinite(col)) return;

		elementCellMapRef.current.set(element, { row, col });
		recordCellMeasurement(row, col, element);
		// Deliberately not flushing here: multiple cells can attach their
		// refs within the same commit, and flushing per-cell would turn the
		// batched applyMeasurements pass back into one pass per cell. The
		// useLayoutEffect further down flushes once per commit.

		const observer = getOrCreateSharedObserver();

		observer?.observe(element);

		// React 19: ref callbacks may return a cleanup, called on detach -
		// replaces manually tracking "was there a previous element" by hand.
		return () => {
			observer?.unobserve(element);
			elementCellMapRef.current.delete(element);
			removeCellMeasurement(row, col);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Order matters: flush (uses the *pre-commit* lastRow/ColRangeRef for the
	// scroll-anchoring check) must run before the ranges get updated below.
	useLayoutEffect(() => {
		flushPendingMeasurements();
	});

	useLayoutEffect(() => {
		const prevRow = lastRowRangeRef.current;
		const prevCol = lastColRangeRef.current;
		const rowRangeChanged =
			prevRow.startIndex !== rowStart || prevRow.endIndex !== rowEnd;
		const colRangeChanged =
			prevCol.startIndex !== colStart || prevCol.endIndex !== colEnd;

		if (rowRangeChanged || colRangeChanged) {
			lastRowRangeRef.current = { startIndex: rowStart, endIndex: rowEnd };
			lastColRangeRef.current = { startIndex: colStart, endIndex: colEnd };

			const range: VirtualGridRange = {
				rowStartIndex: rowStart,
				rowEndIndex: rowEnd,
				colStartIndex: colStart,
				colEndIndex: colEnd,
			};

			optionsRef.current.onRangeChange?.(range);
		}
	}, [rowStart, rowEnd, colStart, colEnd]);

	// --- Imperative scroll API ------------------------------------------

	const scrollToOffset = useCallback(
		(
			offsets: { top: number; left: number },
			scrollOptions?: ScrollToOffsetOptions,
		) => {
			const {
				getScrollElement,
				initialViewportHeight,
				initialViewportWidth,
				rowCount,
				colCount,
				estimateRowHeight,
				estimateColumnWidth,
				rowGap,
				columnGap,
				isRtl,
				scrollMarginTop,
				scrollMarginLeft,
			} = optionsRef.current;

			const scrollEl = getScrollElement();

			if (!scrollEl) return;

			const isRtlValue = isRtl ?? false;
			const marginTop = safeNonNegative(scrollMarginTop);
			const marginLeft = safeNonNegative(scrollMarginLeft);
			const rowGapValue = safeNonNegative(rowGap);
			const colGapValue = safeNonNegative(columnGap);

			const safeRC = safeInt(rowCount);
			const safeCC = safeInt(colCount);

			const totalHeight = getTotalSize(
				safeRC,
				estimateRowHeight,
				rowCacheRef.current,
				rowGapValue,
			);
			const totalWidth = getTotalSize(
				safeCC,
				estimateColumnWidth,
				colCacheRef.current,
				colGapValue,
			);

			const scrollElHeight =
				getScrollElementSize(scrollEl, "vertical")
				|| initialViewportHeight
				|| 0;
			const scrollElWidth =
				getScrollElementSize(scrollEl, "horizontal")
				|| initialViewportWidth
				|| 0;

			const clampedTop = Math.max(
				0,
				Math.min(offsets.top, Math.max(0, totalHeight - scrollElHeight)),
			);
			const clampedLeft = Math.max(
				0,
				Math.min(offsets.left, Math.max(0, totalWidth - scrollElWidth)),
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			const scrollToOpts: ScrollToOptions = {
				behavior: scrollOptions?.smooth === true ? "smooth" : "auto",
				top: toRawScrollValue(clampedTop, "vertical", isRtlValue, marginTop),
				left: toRawScrollValue(
					clampedLeft,
					"horizontal",
					isRtlValue,
					marginLeft,
				),
			};

			resolvedEl.scrollTo(scrollToOpts);
		},
		[],
	);

	const scrollToRow = useCallback(
		(rowIndex: number, scrollOptions?: ScrollToRowOptions) => {
			const {
				getScrollElement,
				rowCount,
				estimateRowHeight,
				initialViewportHeight,
				rowGap,
				isRtl,
				scrollMarginTop,
			} = optionsRef.current;

			const scrollEl = getScrollElement();

			if (!scrollEl) return;

			const safeRC = safeInt(rowCount);

			if (safeRC === 0) return;

			const safeIdx = Math.max(0, Math.min(safeInt(rowIndex), safeRC - 1));
			const isRtlValue = isRtl ?? false;
			const marginTop = safeNonNegative(scrollMarginTop);
			const rowGapValue = safeNonNegative(rowGap);

			const scrollElHeight =
				getScrollElementSize(scrollEl, "vertical")
				|| initialViewportHeight
				|| 0;
			const totalHeight = getTotalSize(
				safeRC,
				estimateRowHeight,
				rowCacheRef.current,
				rowGapValue,
			);
			const curTop = readEffectiveScrollOffset(
				scrollEl,
				"vertical",
				isRtlValue,
				marginTop,
			);

			const targetTop = calcScrollToAxisOffset(
				safeIdx,
				scrollOptions?.align ?? "auto",
				scrollElHeight,
				totalHeight,
				curTop,
				estimateRowHeight,
				rowCacheRef.current,
				rowGapValue,
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			resolvedEl.scrollTo({
				top: toRawScrollValue(targetTop, "vertical", isRtlValue, marginTop),
				behavior: scrollOptions?.smooth === true ? "smooth" : "auto",
			});
		},
		[],
	);

	const scrollToColumn = useCallback(
		(colIndex: number, scrollOptions?: ScrollToColumnOptions) => {
			const {
				getScrollElement,
				colCount,
				estimateColumnWidth,
				initialViewportWidth,
				columnGap,
				isRtl,
				scrollMarginLeft,
			} = optionsRef.current;

			const scrollEl = getScrollElement();

			if (!scrollEl) return;

			const safeCC = safeInt(colCount);

			if (safeCC === 0) return;

			const safeIdx = Math.max(0, Math.min(safeInt(colIndex), safeCC - 1));
			const isRtlValue = isRtl ?? false;
			const marginLeft = safeNonNegative(scrollMarginLeft);
			const colGapValue = safeNonNegative(columnGap);

			const scrollElWidth =
				getScrollElementSize(scrollEl, "horizontal")
				|| initialViewportWidth
				|| 0;
			const totalWidth = getTotalSize(
				safeCC,
				estimateColumnWidth,
				colCacheRef.current,
				colGapValue,
			);
			const curLeft = readEffectiveScrollOffset(
				scrollEl,
				"horizontal",
				isRtlValue,
				marginLeft,
			);

			const targetLeft = calcScrollToAxisOffset(
				safeIdx,
				scrollOptions?.align ?? "auto",
				scrollElWidth,
				totalWidth,
				curLeft,
				estimateColumnWidth,
				colCacheRef.current,
				colGapValue,
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			resolvedEl.scrollTo({
				left: toRawScrollValue(
					targetLeft,
					"horizontal",
					isRtlValue,
					marginLeft,
				),
				behavior: scrollOptions?.smooth === true ? "smooth" : "auto",
			});
		},
		[],
	);

	const scrollToCell = useCallback(
		(
			rowIndex: number,
			colIndex: number,
			scrollOptions?: ScrollToCellOptions,
		) => {
			const {
				getScrollElement,
				rowCount,
				colCount,
				estimateRowHeight,
				estimateColumnWidth,
				initialViewportHeight,
				initialViewportWidth,
				rowGap,
				columnGap,
				isRtl,
				scrollMarginTop,
				scrollMarginLeft,
			} = optionsRef.current;

			const scrollEl = getScrollElement();

			if (!scrollEl) return;

			const safeRC = safeInt(rowCount);
			const safeCC = safeInt(colCount);

			if (safeRC === 0 || safeCC === 0) return;

			const safeRow = Math.max(0, Math.min(safeInt(rowIndex), safeRC - 1));
			const safeCol = Math.max(0, Math.min(safeInt(colIndex), safeCC - 1));
			const isRtlValue = isRtl ?? false;
			const marginTop = safeNonNegative(scrollMarginTop);
			const marginLeft = safeNonNegative(scrollMarginLeft);
			const rowGapValue = safeNonNegative(rowGap);
			const colGapValue = safeNonNegative(columnGap);

			const scrollElHeight =
				getScrollElementSize(scrollEl, "vertical")
				|| initialViewportHeight
				|| 0;
			const scrollElWidth =
				getScrollElementSize(scrollEl, "horizontal")
				|| initialViewportWidth
				|| 0;

			const totalHeight = getTotalSize(
				safeRC,
				estimateRowHeight,
				rowCacheRef.current,
				rowGapValue,
			);
			const totalWidth = getTotalSize(
				safeCC,
				estimateColumnWidth,
				colCacheRef.current,
				colGapValue,
			);

			const curTop = readEffectiveScrollOffset(
				scrollEl,
				"vertical",
				isRtlValue,
				marginTop,
			);
			const curLeft = readEffectiveScrollOffset(
				scrollEl,
				"horizontal",
				isRtlValue,
				marginLeft,
			);

			const targetTop = calcScrollToAxisOffset(
				safeRow,
				scrollOptions?.rowAlign ?? "auto",
				scrollElHeight,
				totalHeight,
				curTop,
				estimateRowHeight,
				rowCacheRef.current,
				rowGapValue,
			);

			const targetLeft = calcScrollToAxisOffset(
				safeCol,
				scrollOptions?.colAlign ?? "auto",
				scrollElWidth,
				totalWidth,
				curLeft,
				estimateColumnWidth,
				colCacheRef.current,
				colGapValue,
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			resolvedEl.scrollTo({
				top: toRawScrollValue(targetTop, "vertical", isRtlValue, marginTop),
				left: toRawScrollValue(
					targetLeft,
					"horizontal",
					isRtlValue,
					marginLeft,
				),
				behavior: scrollOptions?.smooth === true ? "smooth" : "auto",
			});
		},
		[],
	);

	return {
		virtualCells,
		totalHeight,
		totalWidth,
		isScrolling,
		scrollToOffset,
		scrollToRow,
		scrollToColumn,
		scrollToCell,
		measureElement,
	};
}

export { type UseVirtualGridReturn, useVirtualGrid };
