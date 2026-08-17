import { OffsetCache } from "../../shared/virtualShared/offsetCache.ts";
import {
	getScrollElementOffset,
	getScrollElementSize,
	getSizeAtIndex,
	getStartOffset,
	getTotalSize,
	resolveScrollElement,
} from "../../shared/virtualShared/utils.ts";
import type { ScrollAlign } from "./types.ts";

/**
 * Computes which index range is currently visible along one axis (before
 * overscan is applied), given a scroll position and viewport size. Used by
 * {@link useVirtualGrid} once per axis (rows and columns independently).
 *
 * @remarks
 * Three strategies depending on what's available, cheapest first: a
 * closed-form calculation when `estimateSize` is a constant (O(1)); a
 * binary search via `cache` when `estimateSize` is a function and an
 * {@link OffsetCache} has been built for it (O(log n)); otherwise a linear
 * scan (O(count)) - this last path isn't exercised by {@link useVirtualGrid}
 * itself (which always builds a cache when `estimateSize` is a function),
 * but is kept as a working, gap-aware fallback for standalone use, or for a
 * cache-less caller. Unlike `useVirtualList`'s `calcRange`, there's no
 * `reverse` concept here - grids don't support reversed axes.
 *
 * @param scrollOffset - Current scroll position along this axis, in the grid's own (`scrollMargin`-excluded, RTL-normalized) coordinate space.
 * @param viewportSize - Current viewport size along this axis. Returns an empty range (`{ startIndex: 0, endIndex: -1 }`) if `<= 0`.
 * @param count - Total number of rows or columns. Returns an empty range if `<= 0`.
 * @param estimateSize - A constant size for every item along this axis, or a function called per-index.
 * @param overscan - Extra items included beyond each edge of the computed visible range.
 * @param cache - An {@link OffsetCache} to binary-search, when `estimateSize` is a function.
 * @param gap - Space between consecutive items along this axis.
 * @defaultValue gap `0`
 */
function calcAxisRange(
	scrollOffset: number,
	viewportSize: number,
	count: number,
	estimateSize: number | ((index: number) => number),
	overscan: number,
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
		} else {
			startIndex = Math.max(0, Math.floor(scrollOffset / stride));
			endIndex = Math.min(
				count - 1,
				Math.ceil((scrollOffset + viewportSize) / stride) - 1,
			);
		}
	} else if (cache) {
		// The cache's internal offsets already bake in gap (see OffsetCache).
		const scrollEnd = scrollOffset + viewportSize;

		startIndex = cache.findStartIndex(scrollOffset);
		endIndex = cache.findEndIndex(scrollEnd);
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

	if (endIndex < startIndex) {
		return { startIndex: 0, endIndex: -1 };
	}

	startIndex = Math.max(0, startIndex - overscan);
	endIndex = Math.min(count - 1, endIndex + overscan);

	return { startIndex, endIndex };
}

/**
 * Computes the scroll offset needed to bring `targetIndex` into view along
 * one axis, with the requested alignment - the shared implementation
 * behind `useVirtualGrid`'s `scrollToRow`/`scrollToColumn`/`scrollToCell`
 * and its `initialScrollRow`/`initialScrollCol` options.
 *
 * @remarks
 * Unlike `useVirtualList`'s `calcScrollToOffset`, there's no `reverse`
 * concept to account for here, so `"auto"` (minimize physical scroll
 * distance) needs no special-casing - it's simply whichever edge is
 * nearer.
 *
 * @param targetIndex - Index to scroll to.
 * @param align - How to position the item within the viewport - see {@link ScrollAlign}.
 * @param viewportSize - Current viewport size along this axis.
 * @param totalSize - Total size of all items plus gaps along this axis, as from {@link getTotalSize}.
 * @param currentOffset - Current scroll position along this axis, used to resolve `align: "auto"`.
 * @param estimateSize - A constant size for every item along this axis, or a function called per-index.
 * @param cache - An {@link OffsetCache} to prefer over recomputing, when `estimateSize` is a function.
 * @param gap - Space between consecutive items along this axis.
 * @defaultValue gap `0`
 * @returns The target scroll offset, clamped into `[0, totalSize - viewportSize]`.
 */
function calcScrollToAxisOffset(
	targetIndex: number,
	align: ScrollAlign,
	viewportSize: number,
	totalSize: number,
	currentOffset: number,
	estimateSize: number | ((index: number) => number),
	cache?: OffsetCache,
	gap: number = 0,
): number {
	const itemSize =
		cache ?
			cache.getItemSize(targetIndex)
		:	getSizeAtIndex(targetIndex, estimateSize);

	const itemStart = getStartOffset(targetIndex, estimateSize, cache, gap);
	const itemEnd = itemStart + itemSize;
	const maxOffset = Math.max(0, totalSize - viewportSize);

	let targetOffset: number;

	switch (align) {
		case "start":
			targetOffset = itemStart;
			break;

		case "end":
			targetOffset = Math.max(0, itemEnd - viewportSize);
			break;

		case "center":
			targetOffset = Math.max(0, itemStart + itemSize / 2 - viewportSize / 2);
			break;

		case "auto":
		default: {
			if (
				itemStart >= currentOffset
				&& itemEnd <= currentOffset + viewportSize
			) {
				return currentOffset;
			}

			// Grid has no reverse concept, so "nearest" (minimize scroll
			// distance) is simply this - no reverse-branching needed, unlike
			// the list hook where this had to be fixed to avoid flipping
			// with `reverse`.
			targetOffset =
				itemStart < currentOffset ? itemStart : (
					Math.max(0, itemEnd - viewportSize)
				);
			break;
		}
	}

	return Math.max(0, Math.min(targetOffset, maxOffset));
}

export {
	calcAxisRange,
	calcScrollToAxisOffset,
	getScrollElementOffset,
	getScrollElementSize,
	getSizeAtIndex,
	getStartOffset,
	getTotalSize,
	OffsetCache,
	resolveScrollElement,
};
