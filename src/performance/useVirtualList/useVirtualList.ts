import {
	type Key,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useEventListener } from "../../events/useEventListener/useEventListener.ts";
import { getValue } from "../../shared/utils.ts";
import { useDebouncedCallback } from "../useDebouncer/useDebouncedCallback.ts";
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
	OffsetCache,
	resolveScrollElement,
} from "./utils.ts";

interface UseVirtualListReturn {
	virtualItems: VirtualItem[];
	totalSize: number;
	isScrolling: boolean;
	scrollToIndex: (index: number, options?: ScrollToIndexOptions) => void;
	scrollToOffset: (offset: number, options?: ScrollToOffsetOptions) => void;
}

function useVirtualList<T = unknown>(
	options: UseVirtualListOptions<T>,
): UseVirtualListReturn {
	const {
		count,
		estimateSize,
		getScrollElement,
		overscan = DEFAULT_OVERSCAN,
		horizontal = false,
		reverse = false,
		scrollingDelay = SCROLLING_DEBOUNCE_MS,
		initialViewportSize = 0,
		data,
		itemKey,
		initialOffset,
		initialScrollIndex,
	} = options;

	const safeCount = Math.max(0, Math.trunc(Number(count)) || 0);
	const safeOverscan = Math.max(0, Math.trunc(Number(overscan)) || 0);

	const optionsRef = useRef(options);

	useLayoutEffect(() => {
		optionsRef.current = options;
	});

	const renderCache = useMemo(() => {
		if (typeof estimateSize !== "function") return undefined;

		const cache = new OffsetCache();
		cache.initializeOffsets(safeCount, estimateSize);

		return cache;
	}, [safeCount, estimateSize]);

	const cacheRef = useRef(renderCache);

	useLayoutEffect(() => {
		cacheRef.current = renderCache;
	}, [renderCache]);

	const [scrollOffset, setScrollOffset] = useState(() => {
		if (typeof initialOffset === "number") {
			return Math.max(0, initialOffset);
		}

		if (typeof initialScrollIndex === "number" && safeCount > 0) {
			const safeIdx = Math.max(
				0,
				Math.min(Math.trunc(Number(initialScrollIndex)) || 0, safeCount - 1),
			);

			const naturalStart =
				renderCache ?
					renderCache.getItemStartOffset(safeIdx)
				:	getStartOffset(safeIdx, estimateSize);

			if (reverse) {
				const itemSize =
					renderCache ?
						renderCache.getItemSize(safeIdx)
					:	getSizeAtIndex(safeIdx, estimateSize);
				const totalSize = getTotalSize(safeCount, estimateSize, renderCache);

				return Math.max(0, totalSize - naturalStart - itemSize);
			}

			return naturalStart;
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

			if (
				typeof initialOffset === "number"
				|| typeof initialScrollIndex === "number"
			) {
				const resolvedEl = resolveScrollElement(scrollEl);

				if (resolvedEl) {
					resolvedEl.scrollTo({
						[horizontal ? "left" : "top"]: scrollOffset,
						behavior: "auto",
					});
				}

				return;
			}
		}

		const scrollElOffset = getScrollElementOffset(scrollEl, horizontal);

		setScrollOffset((prev) => (prev === scrollElOffset ? prev : scrollElOffset));
	}, [scrollEl, horizontal, initialOffset, initialScrollIndex, scrollOffset]);

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

	const scrollElSize =
		getScrollElementSize(scrollEl, horizontal) || initialViewportSize;
	const totalSize = getTotalSize(safeCount, estimateSize, renderCache);

	const { startIndex, endIndex } = calcRange(
		scrollOffset,
		scrollElSize,
		totalSize,
		safeCount,
		estimateSize,
		safeOverscan,
		reverse,
		renderCache,
	);

	const virtualItems: VirtualItem[] = [];

	if (startIndex <= endIndex) {
		let cumulativeStart =
			renderCache ?
				renderCache.getItemStartOffset(startIndex)
			:	getStartOffset(startIndex, estimateSize);

		for (let i = startIndex; i <= endIndex; i++) {
			const size =
				renderCache ?
					renderCache.getItemSize(i)
				:	getSizeAtIndex(i, estimateSize);

			const start =
				reverse ? totalSize - cumulativeStart - size : cumulativeStart;

			let key: Key = i;
			if (itemKey) {
				if (typeof itemKey === "function") {
					key = itemKey(i, data?.[i]);
				} else if (data && data[i] !== undefined && data[i] !== null) {
					const val = getValue(data[i], itemKey);

					if (typeof val === "string" || typeof val === "number") {
						key = val;
					}
				}
			}

			virtualItems.push({ key, index: i, size, start });

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
			const scrollElSize =
				getScrollElementSize(scrollEl, isHorizontal)
				|| optionsRef.current.initialViewportSize
				|| 0;

			const callbackCache = cacheRef.current;

			const safeCount = Math.max(0, Math.trunc(Number(count)) || 0);
			const totalSize = getTotalSize(safeCount, estimateSize, callbackCache);

			const clampedOffset = Math.max(
				0,
				Math.min(offset, Math.max(0, totalSize - scrollElSize)),
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			const scrollToOpts: ScrollToOptions = {
				behavior: scrollOptions?.smooth === true ? "smooth" : "auto",
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

			const callbackCache = cacheRef.current;

			const scrollElSize =
				getScrollElementSize(scrollEl, isHorizontal)
				|| optionsRef.current.initialViewportSize
				|| 0;
			const totalSize = getTotalSize(safeCount, estimateSize, callbackCache);
			const curOffset = getScrollElementOffset(scrollEl, isHorizontal);

			const targetOffset = calcScrollToOffset(
				safeIdx,
				align,
				scrollElSize,
				totalSize,
				curOffset,
				estimateSize,
				isReverse,
				callbackCache,
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			const scrollToOpts: ScrollToOptions = {
				behavior: scrollOptions?.smooth === true ? "smooth" : "auto",
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
