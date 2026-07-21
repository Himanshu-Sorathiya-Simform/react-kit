import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEventListener } from "../../events/useEventListener/useEventListener.ts";
import { useDebouncedCallback } from "../useDebounce/useDebouncedCallback.ts";
import { DEFAULT_OVERSCAN, SCROLLING_DEBOUNCE_MS } from "./constants.ts";
import type {
	ScrollToIndexOptions,
	ScrollToOffsetOptions,
	UseVirtualListOptions,
	VirtualItem,
} from "./types.ts";
import {
	calcRange,
	calcScrollToOffset,
	getScrollElementOffset,
	getScrollElementSize,
	getSizeAtIndex,
	getStartOffset,
	getTotalSize,
	resolveScrollElement,
} from "./utils.ts";

interface UseVirtualListReturn {
	virtualItems: VirtualItem[];
	totalSize: number;
	isScrolling: boolean;
	scrollToIndex: (index: number, options?: ScrollToIndexOptions) => void;
	scrollToOffset: (offset: number, options?: ScrollToOffsetOptions) => void;
}

function useVirtualList(options: UseVirtualListOptions): UseVirtualListReturn {
	const [scrollOffset, setScrollOffset] = useState(0);
	const [isScrolling, setIsScrolling] = useState(false);

	const {
		count,
		estimateSize,
		getScrollElement,
		overscan = DEFAULT_OVERSCAN,
		horizontal = false,
		reverse = false,
		scrollingDelay = SCROLLING_DEBOUNCE_MS,
	} = options;

	const safeCount = Math.max(0, Math.trunc(Number(count)) || 0);
	const safeOverscan = Math.max(0, Math.trunc(Number(overscan)) || 0);

	const optionsRef = useRef(options);

	useLayoutEffect(() => {
		optionsRef.current = options;
	});

	const { debouncedFunc: resetIsScrolling } = useDebouncedCallback(
		() => setIsScrolling(false),
		scrollingDelay,
	);

	const scrollEl = getScrollElement();

	useEffect(() => {
		if (!scrollEl) return;

		const { horizontal } = optionsRef.current;

		const scrollElOffset = getScrollElementOffset(scrollEl, horizontal ?? false);

		setScrollOffset(scrollElOffset);
	}, [scrollEl]);

	function handleScroll() {
		const { getScrollElement, horizontal } = optionsRef.current;
		const scrollEl = getScrollElement();

		if (!scrollEl) return;

		const scrollElOffset = getScrollElementOffset(scrollEl, horizontal ?? false);

		setScrollOffset(scrollElOffset);

		const scrollingDelay =
			optionsRef.current.scrollingDelay ?? SCROLLING_DEBOUNCE_MS;

		if (scrollingDelay > 0) {
			setIsScrolling(true);

			resetIsScrolling();
		}
	}

	useEventListener("scroll", handleScroll, {
		target: scrollEl,
		passive: true,
	});

	const scrollElSize = getScrollElementSize(scrollEl, horizontal);
	const totalSize = getTotalSize(safeCount, estimateSize);

	const { startIndex, endIndex } = calcRange(
		scrollOffset,
		scrollElSize,
		totalSize,
		safeCount,
		estimateSize,
		safeOverscan,
		reverse,
	);

	const virtualItems: VirtualItem[] = [];

	if (startIndex <= endIndex) {
		let cumulativeStart = getStartOffset(startIndex, estimateSize);

		for (let i = startIndex; i <= endIndex; i++) {
			const size = getSizeAtIndex(i, estimateSize);

			const start =
				reverse ? totalSize - cumulativeStart - size : cumulativeStart;

			virtualItems.push({ index: i, size, start });

			cumulativeStart += size;
		}
	}

	const scrollToOffset = useCallback(
		(offset: number, scrollOptions?: ScrollToOffsetOptions) => {
			const { getScrollElement, horizontal, count, estimateSize } =
				optionsRef.current;

			const scrollEl = getScrollElement();

			if (!scrollEl) return;

			const isHorizontal = horizontal ?? false;
			const scrollElSize = getScrollElementSize(scrollEl, isHorizontal);

			const safeCount = Math.max(0, Math.trunc(Number(count)) || 0);
			const totalSize = getTotalSize(safeCount, estimateSize);

			const clampedOffset = Math.max(
				0,
				Math.min(offset, Math.max(0, totalSize - scrollElSize)),
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			const scrollToOpts: ScrollToOptions = {
				behavior: scrollOptions?.smooth === true ? "smooth" : "instant",
			};

			if (isHorizontal) {
				scrollToOpts.left = clampedOffset;
			} else {
				scrollToOpts.top = clampedOffset;
			}

			resolvedEl.scrollTo(scrollToOpts);
		},
		[],
	);

	const scrollToIndex = useCallback(
		(index: number, scrollOptions?: ScrollToIndexOptions) => {
			const { getScrollElement, count, estimateSize, horizontal, reverse } =
				optionsRef.current;

			const scrollEl = getScrollElement();

			if (!scrollEl) return;

			const safeCount = Math.max(0, Math.trunc(Number(count)) || 0);
			if (safeCount === 0) return;

			const safeIdx = Math.max(
				0,
				Math.min(Math.trunc(Number(index)) || 0, safeCount - 1),
			);
			const align = scrollOptions?.align ?? "auto";
			const isHorizontal = horizontal ?? false;
			const isReverse = reverse ?? false;

			const scrollElSize = getScrollElementSize(scrollEl, isHorizontal);
			const totalSize = getTotalSize(safeCount, estimateSize);
			const curOffset = getScrollElementOffset(scrollEl, isHorizontal);

			const targetOffset = calcScrollToOffset(
				safeIdx,
				align,
				scrollElSize,
				totalSize,
				curOffset,
				estimateSize,
				isReverse,
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			const scrollToOpts: ScrollToOptions = {
				behavior: scrollOptions?.smooth === true ? "smooth" : "instant",
			};

			if (isHorizontal) {
				scrollToOpts.left = targetOffset;
			} else {
				scrollToOpts.top = targetOffset;
			}

			resolvedEl.scrollTo(scrollToOpts);
		},
		[],
	);

	return {
		virtualItems,
		totalSize,
		isScrolling,
		scrollToIndex,
		scrollToOffset,
	};
}

export { type UseVirtualListReturn, useVirtualList };
