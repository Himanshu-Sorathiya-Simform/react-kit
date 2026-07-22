import { OffsetCache } from "../virtualShared/offsetCache.ts";
import {
	getScrollElementOffset,
	getScrollElementSize,
	getSizeAtIndex,
	getStartOffset,
	getTotalSize,
	resolveScrollElement,
} from "../virtualShared/utils.ts";
import type { ScrollAlign } from "./types.ts";

function calcAxisRange(
	scrollOffset: number,
	viewportSize: number,
	count: number,
	estimateSize: number | ((index: number) => number),
	overscan: number,
	cache?: OffsetCache,
): { startIndex: number; endIndex: number } {
	if (count <= 0 || viewportSize <= 0) {
		return { startIndex: 0, endIndex: -1 };
	}

	let startIndex: number;
	let endIndex: number;

	if (typeof estimateSize === "number") {
		const safeSize = Math.max(0, estimateSize);

		if (safeSize === 0) {
			startIndex = 0;
			endIndex = count - 1;
		} else {
			startIndex = Math.max(0, Math.floor(scrollOffset / safeSize));
			endIndex = Math.min(
				count - 1,
				Math.ceil((scrollOffset + viewportSize) / safeSize) - 1,
			);
		}
	} else if (cache) {
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

			cumOffset += itemSize;
		}

		if (!foundStart) {
			startIndex = 0;
			endIndex = -1;
		}
	}

	startIndex = Math.max(0, startIndex - overscan);
	endIndex = Math.min(count - 1, endIndex + overscan);

	return { startIndex, endIndex };
}

function calcScrollToAxisOffset(
	targetIndex: number,
	align: ScrollAlign,
	viewportSize: number,
	totalSize: number,
	currentOffset: number,
	estimateSize: number | ((index: number) => number),
	cache?: OffsetCache,
): number {
	const itemSize =
		cache ?
			cache.getItemSize(targetIndex)
		:	getSizeAtIndex(targetIndex, estimateSize);

	const itemStart = getStartOffset(targetIndex, estimateSize, cache);
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

			if (itemStart < currentOffset) {
				targetOffset = itemStart;
			} else {
				targetOffset = Math.max(0, itemEnd - viewportSize);
			}

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
