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
import { useIntersectionObserver } from "../../performance/useIntersectionObserver/useIntersectionObserver.ts";
import { useResizeObserver } from "../../performance/useResizeObserver/useResizeObserver.ts";
import { getValue } from "../../shared/stateShared/utils.ts";
import { useDebouncedCallback } from "../useDebouncer/useDebouncedCallback.ts";
import { DEFAULT_OVERSCAN, SCROLLING_DEBOUNCE_MS } from "./constants.ts";
import type {
	ScrollToIndexOptions,
	ScrollToOffsetOptions,
	UseVirtualListOptions,
	VirtualItem,
	VirtualRange,
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

/** Return value of {@link useVirtualList}. */
interface UseVirtualListReturn {
	/** The currently-rendered items (visible range plus overscan), each with a computed `size`/`start`/`end`. Render these, not the full `count`. */
	virtualItems: VirtualItem[];
	/** Total size of all `count` items plus gaps, along the scrolling axis - set this as the virtualized container's height (or width, if `horizontal`) so the scrollbar is sized correctly. */
	totalSize: number;
	/** Whether the list is currently scrolling, per `scrollingDelay`. Useful for cheaper rendering (e.g. skipping expensive item content) while actively scrolling. */
	isScrolling: boolean;
	/** Imperatively scrolls so the given index is visible, per the requested {@link ScrollToIndexOptions.align}. Stable across renders - safe to put in a dependency array. */
	scrollToIndex: (index: number, options?: ScrollToIndexOptions) => void;
	/** Imperatively scrolls to an exact offset, clamped into range. Stable across renders. */
	scrollToOffset: (offset: number, options?: ScrollToOffsetOptions) => void;
	/**
	 * Attach to your rendered item's DOM node to enable dynamic measurement:
	 * `<div ref={measureElement} data-index={item.index}>`. Reads the index
	 * from a data-index attribute (rather than taking it as a parameter) so
	 * this stays referentially stable and can be passed directly as `ref`
	 * without an inline wrapper causing detach/reattach on every render.
	 * No-op when estimateSize is a plain number (nothing to refine).
	 */
	measureElement: RefCallback<Element>;
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
 * Raw DOM `scrollTop`/`scrollLeft` -> effective offset: normalizes away
 * `scrollMargin` (subtracted) and RTL's negative-`scrollLeft` convention
 * (absolute-valued), so the rest of this hook can work in one consistent,
 * always-non-negative coordinate space regardless of those two options.
 */
function readEffectiveScrollOffset(
	scrollEl: HTMLElement | Window | Document,
	horizontal: boolean,
	isRtl: boolean,
	scrollMargin: number,
): number {
	const raw = getScrollElementOffset(scrollEl, horizontal);
	const rtlAdjusted = isRtl && horizontal ? Math.abs(raw) : raw;

	return Math.max(0, rtlAdjusted - scrollMargin);
}

/** Inverse of {@link readEffectiveScrollOffset}: effective offset -> the raw value to hand to `Element.scrollTo`. */
function toRawScrollValue(
	effectiveOffset: number,
	horizontal: boolean,
	isRtl: boolean,
	scrollMargin: number,
): number {
	const withMargin = effectiveOffset + scrollMargin;

	return isRtl && horizontal ? -withMargin : withMargin;
}

/**
 * Renders only the items currently visible in a scrollable container (plus
 * a small overscan buffer), instead of the full list - keeps DOM node count
 * roughly constant regardless of how many items there are in total.
 *
 * @remarks
 * Core behavior comes from `count` + `estimateSize` + `getScrollElement`;
 * everything else in {@link UseVirtualListOptions} is opt-in on top of that:
 * `horizontal`/`isRtl` for axis and direction, `reverse` for chat-style
 * bottom-anchored layouts, `gap`/`scrollMargin` for layout details,
 * `measureElement` (returned) for refining `estimateSize` with real
 * rendered sizes, `pauseWhenOffscreen`/`enabled` for pausing tracking when
 * inactive, and `initialOffset`/`initialScrollIndex` for where to start
 * scrolled to.
 *
 * `estimateSize` as a function should be memoized (stable across renders)
 * - see the note on {@link UseVirtualListOptions.estimateSize} for why.
 *
 * @typeParam T - Type of each item in `data`, when using `data` + a
 * string/string-array `itemKey` to derive keys from your own data shape.
 *
 * @param options - See {@link UseVirtualListOptions}.
 * @returns See {@link UseVirtualListReturn}.
 *
 * @example
 * Fixed-size list:
 * ```tsx
 * function List({ items }: { items: string[] }) {
 *   const scrollRef = useRef<HTMLDivElement>(null);
 *   const { virtualItems, totalSize } = useVirtualList({
 *     count: items.length,
 *     estimateSize: 40,
 *     getScrollElement: () => scrollRef.current,
 *   });
 *
 *   return (
 *     <div ref={scrollRef} style={{ height: 400, overflow: "auto" }}>
 *       <div style={{ height: totalSize, position: "relative" }}>
 *         {virtualItems.map((item) => (
 *           <div
 *             key={item.key}
 *             style={{ position: "absolute", top: item.start, height: item.size }}
 *           >
 *             {items[item.index]}
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * Variable-size items, refined by real measurements:
 * ```tsx
 * const { virtualItems, totalSize, measureElement } = useVirtualList({
 *   count: items.length,
 *   estimateSize: (index) => estimateFor(items[index]), // rough guess
 *   getScrollElement: () => scrollRef.current,
 * });
 * // in the row: <div ref={measureElement} data-index={item.index}>...
 * ```
 */
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
		isRtl = false,
		gap = 0,
		scrollMargin = 0,
		enabled = true,
		pauseWhenOffscreen = false,
		scrollingDelay = SCROLLING_DEBOUNCE_MS,
		initialViewportSize = 0,
		data,
		itemKey,
		initialOffset,
		initialScrollIndex,
		initialScrollAlign = "start",
	} = options;
	// adjustScrollOnMeasure and onRangeChange are intentionally not
	// destructured here - both are only ever read via optionsRef.current
	// (inside flushPendingMeasurements and the range-change effect,
	// respectively) so that a later change to either takes effect
	// immediately without needing to be threaded through as an effect
	// dependency.

	const safeCount = safeInt(count);
	const safeOverscan = safeInt(overscan);
	const safeGap = safeNonNegative(gap);
	const safeScrollMargin = safeNonNegative(scrollMargin);

	// scrollToIndex/scrollToOffset/measureElement are returned to the
	// consumer to call whenever they like, so they can't be built with
	// useEffectEvent (Effect Events may only be called from this hook's own
	// effects, never handed out - react.dev/reference/react/useEffectEvent).
	// The ref-for-latest-values pattern is the correct tool for a stable,
	// publicly-exposed imperative callback.
	const optionsRef = useRef(options);

	useLayoutEffect(() => {
		optionsRef.current = options;
	});

	const renderCache = useMemo(() => {
		if (typeof estimateSize !== "function") return undefined;

		const cache = new OffsetCache();
		cache.initializeOffsets(safeCount, estimateSize, safeGap);

		return cache;
	}, [safeCount, estimateSize, safeGap]);

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
				Math.min(safeInt(initialScrollIndex), safeCount - 1),
			);
			const total = getTotalSize(
				safeCount,
				estimateSize,
				renderCache,
				safeGap,
			);

			return calcScrollToOffset(
				safeIdx,
				initialScrollAlign,
				initialViewportSize,
				total,
				0,
				estimateSize,
				reverse,
				renderCache,
				safeGap,
			);
		}

		return 0;
	});
	const [isScrolling, setIsScrolling] = useState(false);
	// Bumped only when OffsetCache is mutated in place by a measurement and
	// nothing else (like setScrollOffset) already forced a re-render for it.
	const [, setMeasurementVersion] = useState(0);
	const initialScrollMounted = useRef(false);

	const { debouncedFunc: resetIsScrolling } = useDebouncedCallback(
		() => setIsScrolling(false),
		scrollingDelay,
	);

	const scrollEl = getScrollElement();

	// useLayoutEffect (not useEffect): applying the initial scroll position
	// must happen before paint, or there's a visible one-frame flash at
	// scrollOffset 0 before it jumps to the intended position.
	useLayoutEffect(() => {
		if (!scrollEl) return;

		if (!initialScrollMounted.current) {
			initialScrollMounted.current = true;

			if (
				typeof initialOffset === "number"
				|| typeof initialScrollIndex === "number"
			) {
				const resolvedEl = resolveScrollElement(scrollEl);

				if (resolvedEl) {
					const rawTarget = toRawScrollValue(
						scrollOffset,
						horizontal,
						isRtl,
						safeScrollMargin,
					);

					const scrollToOpts: ScrollToOptions = { behavior: "auto" };

					if (horizontal) {
						scrollToOpts.left = rawTarget;
					} else {
						scrollToOpts.top = rawTarget;
					}

					resolvedEl.scrollTo(scrollToOpts);
				}

				return;
			}
		}

		const effectiveOffset = readEffectiveScrollOffset(
			scrollEl,
			horizontal,
			isRtl,
			safeScrollMargin,
		);

		setScrollOffset((prev) =>
			prev === effectiveOffset ? prev : effectiveOffset,
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scrollEl, horizontal, isRtl, safeScrollMargin]);

	function handleScroll() {
		const { getScrollElement, horizontal, isRtl, scrollMargin } =
			optionsRef.current;

		const scrollEl = getScrollElement();

		if (!scrollEl) return;

		const effectiveOffset = readEffectiveScrollOffset(
			scrollEl,
			horizontal ?? false,
			isRtl ?? false,
			safeNonNegative(scrollMargin),
		);

		setScrollOffset(effectiveOffset);
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

		// Window/Document scrolling has no meaningful "offscreen" state of
		// its own - it *is* the viewport.
		return el instanceof Window || el instanceof Document ? null : el;
	}

	const { isIntersecting: scrollElVisible } = useIntersectionObserver({
		target: getVisibilityTarget,
		enabled: pauseConfig !== null,
		root: pauseConfig?.root,
		rootMargin: pauseConfig?.rootMargin,
		// Assume visible until proven otherwise, and whenever there's no
		// applicable Element target (Window/Document scrolling, or before
		// getScrollElement resolves) - the safe default is "don't pause"
		// rather than silently freezing a list that should be active.
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

	const measuredSize = horizontal ? observedWidth : observedHeight;
	const scrollElSize = measuredSize || initialViewportSize;
	const totalSize = getTotalSize(safeCount, estimateSize, renderCache, safeGap);

	const { startIndex, endIndex } = calcRange(
		scrollOffset,
		scrollElSize,
		totalSize,
		safeCount,
		estimateSize,
		safeOverscan,
		reverse,
		renderCache,
		safeGap,
	);

	const virtualItems: VirtualItem[] = [];

	if (startIndex <= endIndex) {
		let cumulativeStart =
			renderCache ?
				renderCache.getItemStartOffset(startIndex)
			:	getStartOffset(startIndex, estimateSize, undefined, safeGap);

		for (let i = startIndex; i <= endIndex; i++) {
			const size =
				renderCache ?
					renderCache.getItemSize(i)
				:	getSizeAtIndex(i, estimateSize);

			const start =
				reverse ? totalSize - cumulativeStart - size : cumulativeStart;
			const end = start + size;

			let key: string | number = i;
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

			virtualItems.push({ key, index: i, size, start, end });

			cumulativeStart += size + (i < safeCount - 1 ? safeGap : 0);
		}
	}

	// --- Dynamic measurement (measureElement) -------------------------------

	const pendingMeasurementsRef = useRef<Map<number, number>>(new Map());
	const elementIndexMapRef = useRef<WeakMap<Element, number>>(new WeakMap());
	const sharedObserverRef = useRef<ResizeObserver | null>(null);
	// Range as of the last commit, used as the "already stable, don't let it
	// jump" reference for scroll-anchoring - deliberately updated *after*
	// flushPendingMeasurements runs (see effect ordering below), so a flush
	// always compares against the range the user actually last saw painted,
	// not the range that is only just now being committed.
	const lastRangeRef = useRef<VirtualRange>({ startIndex, endIndex });

	useEffect(() => {
		return () => {
			sharedObserverRef.current?.disconnect();
			sharedObserverRef.current = null;
		};
	}, []);

	function recordMeasurement(index: number, element: Element) {
		const isHorizontal = optionsRef.current.horizontal ?? false;
		const rect = element.getBoundingClientRect();
		const measured = isHorizontal ? rect.width : rect.height;

		pendingMeasurementsRef.current.set(index, measured);
	}

	function flushPendingMeasurements() {
		if (pendingMeasurementsRef.current.size === 0) return;

		const cache = cacheRef.current;

		if (!cache) {
			pendingMeasurementsRef.current.clear();
			return;
		}

		const isReverse = optionsRef.current.reverse ?? false;
		const range = lastRangeRef.current;

		let compensation = 0;

		for (const [index, newSize] of pendingMeasurementsRef.current) {
			const isBeforeViewport =
				isReverse ? index > range.endIndex : index < range.startIndex;

			if (isBeforeViewport) {
				compensation += newSize - cache.getItemSize(index);
			}
		}

		const changed = cache.applyMeasurements(pendingMeasurementsRef.current);

		pendingMeasurementsRef.current.clear();

		const shouldAdjust = optionsRef.current.adjustScrollOnMeasure ?? true;

		if (shouldAdjust && compensation !== 0) {
			const currentScrollEl = optionsRef.current.getScrollElement();
			const isHorizontal = optionsRef.current.horizontal ?? false;
			const isRtlValue = optionsRef.current.isRtl ?? false;
			const marginValue = safeNonNegative(optionsRef.current.scrollMargin);

			if (currentScrollEl) {
				const currentEffective = readEffectiveScrollOffset(
					currentScrollEl,
					isHorizontal,
					isRtlValue,
					marginValue,
				);
				const nextEffective = Math.max(0, currentEffective + compensation);
				const rawTarget = toRawScrollValue(
					nextEffective,
					isHorizontal,
					isRtlValue,
					marginValue,
				);

				const resolvedEl = resolveScrollElement(currentScrollEl);

				if (resolvedEl) {
					const scrollToOpts: ScrollToOptions = { behavior: "auto" };

					if (isHorizontal) {
						scrollToOpts.left = rawTarget;
					} else {
						scrollToOpts.top = rawTarget;
					}

					resolvedEl.scrollTo(scrollToOpts);
				}

				setScrollOffset(nextEffective);

				return;
			}
		}

		if (changed) {
			setMeasurementVersion((v) => v + 1);
		}
	}

	function getOrCreateSharedObserver(): ResizeObserver | null {
		if (sharedObserverRef.current) return sharedObserverRef.current;
		if (typeof ResizeObserver === "undefined") return null;

		sharedObserverRef.current = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const index = elementIndexMapRef.current.get(entry.target);

				if (index === undefined) continue;

				recordMeasurement(index, entry.target);
			}

			flushPendingMeasurements();
		});

		return sharedObserverRef.current;
	}

	const measureElement = useCallback<RefCallback<Element>>((element) => {
		if (!element) return;
		// Read fresh, not the outer destructured `estimateSize` - this
		// closure is frozen at first render (see the eslint-disable below),
		// so closing over the destructured value directly would freeze
		// whether measurement is active based on whatever estimateSize was
		// on mount, even if it later switches from a number to a function.
		if (typeof optionsRef.current.estimateSize !== "function") return;

		const indexAttr = element.getAttribute("data-index");
		const index = indexAttr !== null ? Number(indexAttr) : NaN;

		if (!Number.isFinite(index)) return;

		elementIndexMapRef.current.set(element, index);
		recordMeasurement(index, element);
		// Deliberately not flushing here: multiple items can attach their
		// refs within the same commit, and flushing per-item would turn the
		// batched O(n) applyMeasurements pass below back into an O(n) pass
		// per item. The useLayoutEffect further down flushes once per
		// commit, after every ref callback for that commit has run.

		const observer = getOrCreateSharedObserver();

		observer?.observe(element);

		// React 19: ref callbacks may return a cleanup, called on detach -
		// replaces manually tracking "was there a previous element to
		// unobserve" by hand.
		return () => {
			observer?.unobserve(element);
			elementIndexMapRef.current.delete(element);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Order matters: flush (uses the *pre-commit* lastRangeRef for the
	// scroll-anchoring check) must run before the range gets updated below.
	useLayoutEffect(() => {
		flushPendingMeasurements();
	});

	useLayoutEffect(() => {
		const prev = lastRangeRef.current;

		if (prev.startIndex !== startIndex || prev.endIndex !== endIndex) {
			lastRangeRef.current = { startIndex, endIndex };
			optionsRef.current.onRangeChange?.({ startIndex, endIndex });
		}
	}, [startIndex, endIndex]);

	// --- Imperative scroll API ------------------------------------------

	const scrollToOffset = useCallback(
		(offset: number, scrollOptions?: ScrollToOffsetOptions) => {
			const {
				getScrollElement,
				horizontal,
				count,
				estimateSize,
				gap,
				isRtl,
				scrollMargin,
			} = optionsRef.current;

			const scrollEl = getScrollElement();

			if (!scrollEl) return;

			const isHorizontal = horizontal ?? false;
			const isRtlValue = isRtl ?? false;
			const marginValue = safeNonNegative(scrollMargin);
			const gapValue = safeNonNegative(gap);

			const scrollElSize =
				getScrollElementSize(scrollEl, isHorizontal)
				|| optionsRef.current.initialViewportSize
				|| 0;

			const callbackCache = cacheRef.current;
			const safeCount = safeInt(count);
			const totalSize = getTotalSize(
				safeCount,
				estimateSize,
				callbackCache,
				gapValue,
			);

			const clampedOffset = Math.max(
				0,
				Math.min(offset, Math.max(0, totalSize - scrollElSize)),
			);
			const rawTarget = toRawScrollValue(
				clampedOffset,
				isHorizontal,
				isRtlValue,
				marginValue,
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			const scrollToOpts: ScrollToOptions = {
				behavior: scrollOptions?.smooth === true ? "smooth" : "auto",
			};

			if (isHorizontal) {
				scrollToOpts.left = rawTarget;
			} else {
				scrollToOpts.top = rawTarget;
			}

			resolvedEl.scrollTo(scrollToOpts);
		},
		[],
	);

	const scrollToIndex = useCallback(
		(index: number, scrollOptions?: ScrollToIndexOptions) => {
			const {
				getScrollElement,
				count,
				estimateSize,
				horizontal,
				reverse,
				gap,
				isRtl,
				scrollMargin,
			} = optionsRef.current;

			const scrollEl = getScrollElement();

			if (!scrollEl) return;

			const safeCount = safeInt(count);
			if (safeCount === 0) return;

			const safeIdx = Math.max(0, Math.min(safeInt(index), safeCount - 1));
			const align = scrollOptions?.align ?? "auto";
			const isHorizontal = horizontal ?? false;
			const isReverse = reverse ?? false;
			const isRtlValue = isRtl ?? false;
			const marginValue = safeNonNegative(scrollMargin);
			const gapValue = safeNonNegative(gap);

			const callbackCache = cacheRef.current;

			const scrollElSize =
				getScrollElementSize(scrollEl, isHorizontal)
				|| optionsRef.current.initialViewportSize
				|| 0;
			const totalSize = getTotalSize(
				safeCount,
				estimateSize,
				callbackCache,
				gapValue,
			);
			const curOffset = readEffectiveScrollOffset(
				scrollEl,
				isHorizontal,
				isRtlValue,
				marginValue,
			);

			const targetOffset = calcScrollToOffset(
				safeIdx,
				align,
				scrollElSize,
				totalSize,
				curOffset,
				estimateSize,
				isReverse,
				callbackCache,
				gapValue,
			);

			const rawTarget = toRawScrollValue(
				targetOffset,
				isHorizontal,
				isRtlValue,
				marginValue,
			);

			const resolvedEl = resolveScrollElement(scrollEl);

			if (!resolvedEl) return;

			const scrollToOpts: ScrollToOptions = {
				behavior: scrollOptions?.smooth === true ? "smooth" : "auto",
			};

			if (isHorizontal) {
				scrollToOpts.left = rawTarget;
			} else {
				scrollToOpts.top = rawTarget;
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
		measureElement,
	};
}

export { type UseVirtualListReturn, useVirtualList };
