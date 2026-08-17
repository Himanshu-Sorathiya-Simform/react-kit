import { OffsetCache } from "../../shared/virtualShared/offsetCache.ts";
import {
	getScrollElementOffset as _getScrollElementOffset,
	getScrollElementSize as _getScrollElementSize,
	getSizeAtIndex,
	getStartOffset,
	getTotalSize,
	resolveScrollElement,
} from "../../shared/virtualShared/utils.ts";
import type { ScrollAlign } from "./types.ts";

/** `useVirtualList`-local convenience wrapper: same as the shared `getScrollElementSize`, but takes a `horizontal` boolean instead of an `Axis` string. */
function getScrollElementSize(
	el: HTMLElement | Window | Document | null,
	horizontal: boolean,
): number {
	return _getScrollElementSize(el, horizontal ? "horizontal" : "vertical");
}

/** `useVirtualList`-local convenience wrapper: same as the shared `getScrollElementOffset`, but takes a `horizontal` boolean instead of an `Axis` string. */
function getScrollElementOffset(
	el: HTMLElement | Window | Document | null,
	horizontal: boolean,
): number {
	return _getScrollElementOffset(el, horizontal ? "horizontal" : "vertical");
}

/**
 * Computes which index range is currently visible (before overscan is
 * applied), given a scroll position and viewport size.
 *
 * @remarks
 * Three strategies depending on what's available, cheapest first: a
 * closed-form calculation when `estimateSize` is a constant (O(1)); a
 * binary search via `cache` when `estimateSize` is a function and a
 * {@link OffsetCache} has been built for it (O(log n)); otherwise a linear
 * scan (O(count)) - this last path isn't exercised by
 * {@link useVirtualList} itself (which always builds a cache when
 * `estimateSize` is a function), but is kept as a working, gap-aware
 * fallback for standalone use of this function, or for a cache-less caller.
 *
 * @param scrollOffset - Current scroll position, in the list's own (`scrollMargin`-excluded, RTL-normalized) coordinate space.
 * @param viewportSize - Current viewport size along the scrolling axis. Returns an empty range (`{ startIndex: 0, endIndex: -1 }`) if `<= 0`.
 * @param totalSize - Total size of all `count` items plus gaps, as from {@link getTotalSize}.
 * @param count - Total number of items. Returns an empty range if `<= 0`.
 * @param estimateSize - A constant size for every item, or a function called per-index.
 * @param overscan - Extra items included beyond each edge of the computed visible range.
 * @param reverse - Whether items are laid out in reverse physical order - see {@link UseVirtualListOptions.reverse}.
 * @param cache - An {@link OffsetCache} to binary-search, when `estimateSize` is a function.
 * @param gap - Space between consecutive items.
 * @defaultValue gap `0`
 */
function calcRange(
	scrollOffset: number,
	viewportSize: number,
	totalSize: number,
	count: number,
	estimateSize: number | ((index: number) => number),
	overscan: number,
	reverse: boolean,
	cache?: OffsetCache,
	gap: number = 0,
): { startIndex: number; endIndex: number } {
	if (count <= 0 || viewportSize <= 0) {
		return { startIndex: 0, endIndex: -1 };
	}

	const safeGap = Math.max(0, gap);

	let startIndex: number;
	let endIndex: number;

	if (typeof estimateSize === "number") {
		const safeSize = Math.max(0, estimateSize);
		const stride = safeSize + safeGap;

		if (stride === 0) {
			startIndex = 0;
			endIndex = count - 1;
		} else if (reverse) {
			startIndex = Math.max(
				0,
				Math.floor((totalSize - scrollOffset - viewportSize) / stride),
			);
			endIndex = Math.min(
				count - 1,
				Math.ceil((totalSize - scrollOffset) / stride) - 1,
			);
		} else {
			startIndex = Math.max(0, Math.floor(scrollOffset / stride));
			endIndex = Math.min(
				count - 1,
				Math.ceil((scrollOffset + viewportSize) / stride) - 1,
			);
		}
	} else if (cache) {
		// The cache's internal offsets already bake in gap (see OffsetCache),
		// so the binary-search lookups below need no gap-specific handling.
		const scrollEnd = scrollOffset + viewportSize;

		if (reverse) {
			// Physical position decreases as index increases in reverse mode
			// (index 0 sits at the bottom, count-1 at the top), so the
			// "top edge" query (scrollOffset) yields the numerically largest
			// visible index and the "bottom edge" query (scrollEnd) yields
			// the numerically smallest. startIndex/endIndex need numeric
			// min/max respectively for the render loop below.
			startIndex = cache.findBottomIndexReverse(scrollEnd, totalSize);
			endIndex = cache.findTopIndexReverse(scrollOffset, totalSize);
		} else {
			startIndex = cache.findStartIndex(scrollOffset);
			endIndex = cache.findEndIndex(scrollEnd);
		}
	} else {
		if (reverse) {
			startIndex = count;
			endIndex = -1;
			let cumFromTop = 0;

			for (let i = 0; i < count; i++) {
				const itemSize = getSizeAtIndex(i, estimateSize);
				const itemEnd = totalSize - cumFromTop;
				const itemStart = itemEnd - itemSize;

				if (totalSize - cumFromTop <= scrollOffset) break;

				if (itemStart < scrollOffset + viewportSize) {
					if (i < startIndex) {
						startIndex = i;
					}

					endIndex = i;
				}

				cumFromTop += itemSize + (i < count - 1 ? safeGap : 0);
			}

			if (startIndex === count) {
				startIndex = 0;
				endIndex = -1;
			}
		} else {
			startIndex = 0;
			endIndex = -1;
			let cumOffset = 0;
			let foundStart = false;

			for (let i = 0; i < count; i++) {
				const itemSize = getSizeAtIndex(i, estimateSize);
				const itemEnd = cumOffset + itemSize;

				if (!foundStart && itemEnd > scrollOffset) {
					startIndex = i;
					foundStart = true;
				}

				if (foundStart) {
					if (cumOffset < scrollOffset + viewportSize) {
						endIndex = i;
					} else {
						break;
					}
				}

				cumOffset += itemSize + (i < count - 1 ? safeGap : 0);
			}

			if (!foundStart) {
				startIndex = 0;
				endIndex = -1;
			}
		}
	}

	if (endIndex < startIndex) {
		return { startIndex: 0, endIndex: -1 };
	}

	startIndex = Math.max(0, startIndex - overscan);
	endIndex = Math.min(count - 1, endIndex + overscan);

	return { startIndex, endIndex };
}

/**
 * Computes the scroll offset needed to bring `targetIndex` into view with
 * the requested alignment - the shared implementation behind
 * `useVirtualList`'s `scrollToIndex` and its `initialScrollIndex` option.
 *
 * @remarks
 * For `"start"`/`"end"`, `reverse` flips which physical edge is targeted,
 * since those are defined relative to the *logical* reading direction
 * (which visually flips in reverse layouts). `"auto"` deliberately does
 * **not** flip with `reverse` - it always resolves to whichever edge
 * requires the least physical scroll distance, since "nearest" is a
 * physical-space concept, not a logical-direction one.
 *
 * @param targetIndex - Index to scroll to.
 * @param align - How to position the item within the viewport - see {@link ScrollAlign}.
 * @param viewportSize - Current viewport size along the scrolling axis.
 * @param totalSize - Total size of all items plus gaps, as from {@link getTotalSize}.
 * @param currentOffset - Current scroll position, used to resolve `align: "auto"`.
 * @param estimateSize - A constant size for every item, or a function called per-index.
 * @param reverse - Whether items are laid out in reverse physical order.
 * @param cache - An {@link OffsetCache} to prefer over recomputing, when `estimateSize` is a function.
 * @param gap - Space between consecutive items.
 * @defaultValue gap `0`
 * @returns The target scroll offset, clamped into `[0, totalSize - viewportSize]`.
 */
function calcScrollToOffset(
	targetIndex: number,
	align: ScrollAlign,
	viewportSize: number,
	totalSize: number,
	currentOffset: number,
	estimateSize: number | ((index: number) => number),
	reverse: boolean,
	cache?: OffsetCache,
	gap: number = 0,
): number {
	const itemSize =
		cache ?
			cache.getItemSize(targetIndex)
		:	getSizeAtIndex(targetIndex, estimateSize);

	const physicalStart =
		reverse ?
			cache ? cache.getPhysicalStartReverse(targetIndex, totalSize)
			:	totalSize
				- getStartOffset(targetIndex, estimateSize, undefined, gap)
				- itemSize
		:	getStartOffset(targetIndex, estimateSize, cache, gap);

	const physicalEnd = physicalStart + itemSize;

	const maxOffset = Math.max(0, totalSize - viewportSize);

	let targetOffset: number;

	switch (align) {
		case "start":
			targetOffset =
				reverse ? Math.max(0, physicalEnd - viewportSize) : physicalStart;
			break;

		case "end":
			targetOffset =
				reverse ? physicalStart : Math.max(0, physicalEnd - viewportSize);
			break;

		case "center":
			targetOffset = Math.max(
				0,
				physicalStart + itemSize / 2 - viewportSize / 2,
			);
			break;

		case "auto":
		default: {
			if (
				physicalStart >= currentOffset
				&& physicalEnd <= currentOffset + viewportSize
			) {
				return currentOffset;
			}

			// "Nearest" is a physical-space concept (minimize scroll
			// distance) - unlike "start"/"end", it should not flip with
			// `reverse`. physicalStart/physicalEnd are already expressed
			// in scrollOffset-space regardless of layout direction.
			targetOffset =
				physicalStart < currentOffset ? physicalStart : (
					Math.max(0, physicalEnd - viewportSize)
				);
			break;
		}
	}

	return Math.max(0, Math.min(targetOffset, maxOffset));
}

export {
	calcRange,
	calcScrollToOffset,
	getScrollElementOffset,
	getScrollElementSize,
	getSizeAtIndex,
	getStartOffset,
	getTotalSize,
	OffsetCache,
	resolveScrollElement,
};
