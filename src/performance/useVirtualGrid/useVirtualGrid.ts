import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useEventListener } from "../../events/useEventListener/useEventListener.ts";
import { useDebouncedCallback } from "../useDebouncer/useDebouncedCallback.ts";
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

interface UseVirtualGridReturn {
	virtualCells: VirtualCell[];
	totalHeight: number;
	totalWidth: number;
	isScrolling: boolean;
	scrollToCell: (
		rowIndex: number,
		colIndex: number,
		options?: ScrollToCellOptions,
	) => void;
	scrollToOffset: (
		offsets: { top: number; left: number },
		options?: ScrollToOffsetOptions,
	) => void;
	scrollToRow: (rowIndex: number, options?: ScrollToRowOptions) => void;
	scrollToColumn: (colIndex: number, options?: ScrollToColumnOptions) => void;
}

function useVirtualGrid(options: UseVirtualGridOptions): UseVirtualGridReturn {
	const {
		rowCount,
		colCount,
		estimateRowHeight,
		estimateColumnWidth,
		getScrollElement,
		overscanRows = DEFAULT_OVERSCAN_ROWS,
		overscanCols = DEFAULT_OVERSCAN_COLS,
		scrollingDelay = SCROLLING_DEBOUNCE_MS,
		initialViewportHeight = 0,
		initialViewportWidth = 0,
		initialScrollTop,
		initialScrollLeft,
		initialScrollRow,
		initialScrollCol,
		itemKey,
	} = options;

	const safeRowCount = Math.max(0, Math.trunc(Number(rowCount)) || 0);
	const safeColCount = Math.max(0, Math.trunc(Number(colCount)) || 0);
	const safeOverscanRows = Math.max(0, Math.trunc(Number(overscanRows)) || 0);
	const safeOverscanCols = Math.max(0, Math.trunc(Number(overscanCols)) || 0);

	const optionsRef = useRef(options);

	useLayoutEffect(() => {
		optionsRef.current = options;
	});

	const rowCache = useMemo(() => {
		if (typeof estimateRowHeight !== "function") return undefined;

		const cache = new OffsetCache();
		cache.initializeOffsets(safeRowCount, estimateRowHeight);

		return cache;
	}, [safeRowCount, estimateRowHeight]);

	const colCache = useMemo(() => {
		if (typeof estimateColumnWidth !== "function") return undefined;

		const cache = new OffsetCache();
		cache.initializeOffsets(safeColCount, estimateColumnWidth);

		return cache;
	}, [safeColCount, estimateColumnWidth]);

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
				Math.min(
					Math.trunc(Number(initialScrollRow)) || 0,
					safeRowCount - 1,
				),
			);

			return rowCache ?
					rowCache.getItemStartOffset(safeIdx)
				:	getStartOffset(safeIdx, estimateRowHeight);
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
				Math.min(
					Math.trunc(Number(initialScrollCol)) || 0,
					safeColCount - 1,
				),
			);

			return colCache ?
					colCache.getItemStartOffset(safeIdx)
				:	getStartOffset(safeIdx, estimateColumnWidth);
		}

		return 0;
	});

	const [isScrolling, setIsScrolling] = useState(false);
	const [, forceRender] = useState({});
	const initialScrollMounted = useRef(false);

	const { debouncedFunc: resetIsScrolling } = useDebouncedCallback(
		() => setIsScrolling(false),
		scrollingDelay,
	);

	const scrollEl = getScrollElement();

	useEffect(() => {
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
					resolvedEl.scrollTo({
						...(hasInitialTop && { top: scrollTop }),
						...(hasInitialLeft && { left: scrollLeft }),
						behavior: "auto",
					});
				}

				return;
			}
		}

		const scrollElTopOffset = getScrollElementOffset(scrollEl, "vertical");
		const scrollElLeftOffset = getScrollElementOffset(scrollEl, "horizontal");

		setScrollTop((prev) =>
			prev === scrollElTopOffset ? prev : scrollElTopOffset,
		);
		setScrollLeft((prev) =>
			prev === scrollElLeftOffset ? prev : scrollElLeftOffset,
		);
	}, [
		scrollEl,
		initialScrollTop,
		initialScrollLeft,
		initialScrollRow,
		initialScrollCol,
		scrollTop,
		scrollLeft,
	]);

	function handleScroll() {
		const { getScrollElement, scrollingDelay: delay } = optionsRef.current;

		const scrollEl = getScrollElement();

		if (!scrollEl) return;

		const scrollElTopOffset = getScrollElementOffset(scrollEl, "vertical");
		const scrollElLeftOffset = getScrollElementOffset(scrollEl, "horizontal");

		setScrollTop(scrollElTopOffset);
		setScrollLeft(scrollElLeftOffset);

		const effectiveDelay = delay ?? SCROLLING_DEBOUNCE_MS;

		if (effectiveDelay > 0) {
			setIsScrolling(true);
			resetIsScrolling();
		}
	}

	useEventListener("scroll", handleScroll, {
		target: scrollEl,
		passive: true,
	});

	useEffect(() => {
		if (!scrollEl) return;

		const handleResize = () => forceRender({});

		if (scrollEl instanceof Window) {
			scrollEl.addEventListener("resize", handleResize);

			return () => scrollEl.removeEventListener("resize", handleResize);
		}

		const observer = new ResizeObserver(handleResize);
		const target =
			scrollEl instanceof Document ? scrollEl.documentElement : scrollEl;

		observer.observe(target);

		return () => observer.disconnect();
	}, [scrollEl]);

	const scrollElHeight =
		getScrollElementSize(scrollEl, "vertical") || initialViewportHeight;
	const scrollElWidth =
		getScrollElementSize(scrollEl, "horizontal") || initialViewportWidth;

	const totalHeight = getTotalSize(safeRowCount, estimateRowHeight, rowCache);
	const totalWidth = getTotalSize(safeColCount, estimateColumnWidth, colCache);

	const { startIndex: rowStart, endIndex: rowEnd } = calcAxisRange(
		scrollTop,
		scrollElHeight,
		safeRowCount,
		estimateRowHeight,
		safeOverscanRows,
		rowCache,
	);

	const { startIndex: colStart, endIndex: colEnd } = calcAxisRange(
		scrollLeft,
		scrollElWidth,
		safeColCount,
		estimateColumnWidth,
		safeOverscanCols,
		colCache,
	);

	const virtualCells: VirtualCell[] = [];

	if (rowStart <= rowEnd && colStart <= colEnd) {
		let cumulativeTop =
			rowCache ?
				rowCache.getItemStartOffset(rowStart)
			:	getStartOffset(rowStart, estimateRowHeight);

		for (let r = rowStart; r <= rowEnd; r++) {
			const rowHeight =
				rowCache ?
					rowCache.getItemSize(r)
				:	getSizeAtIndex(r, estimateRowHeight);

			let cumulativeLeft =
				colCache ?
					colCache.getItemStartOffset(colStart)
				:	getStartOffset(colStart, estimateColumnWidth);

			for (let c = colStart; c <= colEnd; c++) {
				const colWidth =
					colCache ?
						colCache.getItemSize(c)
					:	getSizeAtIndex(c, estimateColumnWidth);

				const key = itemKey ? itemKey(r, c) : `${r}:${c}`;

				virtualCells.push({
					key,
					rowIndex: r,
					colIndex: c,
					height: rowHeight,
					width: colWidth,
					top: cumulativeTop,
					left: cumulativeLeft,
				});

				cumulativeLeft += colWidth;
			}

			cumulativeTop += rowHeight;
		}
	}

	const scrollToOffset = useCallback(
		(
			offsets: { top: number; left: number },
			scrollOptions?: ScrollToOffsetOptions,
		) => {
			const { getScrollElement, initialViewportHeight, initialViewportWidth } =
				optionsRef.current;

			const scrollEl = getScrollElement();

			if (!scrollEl) return;

			const { rowCount, colCount, estimateRowHeight, estimateColumnWidth } =
				optionsRef.current;

			const safeRC = Math.max(0, Math.trunc(Number(rowCount)) || 0);
			const safeCC = Math.max(0, Math.trunc(Number(colCount)) || 0);

			const totalHeight = getTotalSize(
				safeRC,
				estimateRowHeight,
				rowCacheRef.current,
			);
			const totalWidth = getTotalSize(
				safeCC,
				estimateColumnWidth,
				colCacheRef.current,
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

			resolvedEl.scrollTo({
				top: clampedTop,
				left: clampedLeft,
				behavior: scrollOptions?.smooth === true ? "smooth" : "auto",
			});
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
			} = optionsRef.current;

			const scrollEl = getScrollElement();

			if (!scrollEl) return;

			const safeRC = Math.max(0, Math.trunc(Number(rowCount)) || 0);

			if (safeRC === 0) return;

			const safeIdx = Math.max(
				0,
				Math.min(Math.trunc(Number(rowIndex)) || 0, safeRC - 1),
			);

			const scrollElHeight =
				getScrollElementSize(scrollEl, "vertical")
				|| initialViewportHeight
				|| 0;
			const totalHeight = getTotalSize(
				safeRC,
				estimateRowHeight,
				rowCacheRef.current,
			);
			const scrollElTopOffset = getScrollElementOffset(scrollEl, "vertical");

			const targetTop = calcScrollToAxisOffset(
				safeIdx,
				scrollOptions?.align ?? "auto",
				scrollElHeight,
				totalHeight,
				scrollElTopOffset,
				estimateRowHeight,
				rowCacheRef.current,
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			resolvedEl.scrollTo({
				top: targetTop,
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
			} = optionsRef.current;

			const scrollEl = getScrollElement();

			if (!scrollEl) return;

			const safeCC = Math.max(0, Math.trunc(Number(colCount)) || 0);

			if (safeCC === 0) return;

			const safeIdx = Math.max(
				0,
				Math.min(Math.trunc(Number(colIndex)) || 0, safeCC - 1),
			);

			const scrollElWidth =
				getScrollElementSize(scrollEl, "horizontal")
				|| initialViewportWidth
				|| 0;
			const totalWidth = getTotalSize(
				safeCC,
				estimateColumnWidth,
				colCacheRef.current,
			);
			const scrollElLeftOffset = getScrollElementOffset(
				scrollEl,
				"horizontal",
			);

			const targetLeft = calcScrollToAxisOffset(
				safeIdx,
				scrollOptions?.align ?? "auto",
				scrollElWidth,
				totalWidth,
				scrollElLeftOffset,
				estimateColumnWidth,
				colCacheRef.current,
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			resolvedEl.scrollTo({
				left: targetLeft,
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
			} = optionsRef.current;

			const scrollEl = getScrollElement();

			if (!scrollEl) return;

			const safeRC = Math.max(0, Math.trunc(Number(rowCount)) || 0);
			const safeCC = Math.max(0, Math.trunc(Number(colCount)) || 0);

			if (safeRC === 0 || safeCC === 0) return;

			const safeRow = Math.max(
				0,
				Math.min(Math.trunc(Number(rowIndex)) || 0, safeRC - 1),
			);
			const safeCol = Math.max(
				0,
				Math.min(Math.trunc(Number(colIndex)) || 0, safeCC - 1),
			);

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
			);
			const totalWidth = getTotalSize(
				safeCC,
				estimateColumnWidth,
				colCacheRef.current,
			);

			const scrollElTopOffset = getScrollElementOffset(scrollEl, "vertical");
			const scrollElLeftOffset = getScrollElementOffset(
				scrollEl,
				"horizontal",
			);

			const targetTop = calcScrollToAxisOffset(
				safeRow,
				scrollOptions?.rowAlign ?? "auto",
				scrollElHeight,
				totalHeight,
				scrollElTopOffset,
				estimateRowHeight,
				rowCacheRef.current,
			);

			const targetLeft = calcScrollToAxisOffset(
				safeCol,
				scrollOptions?.colAlign ?? "auto",
				scrollElWidth,
				totalWidth,
				scrollElLeftOffset,
				estimateColumnWidth,
				colCacheRef.current,
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			resolvedEl.scrollTo({
				top: targetTop,
				left: targetLeft,
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
	};
}

export { type UseVirtualGridReturn, useVirtualGrid };
