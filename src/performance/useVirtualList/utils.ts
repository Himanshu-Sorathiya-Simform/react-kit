import { OffsetCache } from "./offsetCache.ts";
import type { ScrollAlign } from "./types.ts";

function getSizeAtIndex(
	index: number,
	estimateSize: number | ((index: number) => number),
): number {
	const raw =
		typeof estimateSize === "function" ? estimateSize(index) : estimateSize;

	const size = Number(raw);

	return Number.isFinite(size) && size >= 0 ? size : 0;
}

function getStartOffset(
	index: number,
	estimateSize: number | ((index: number) => number),
	cache?: OffsetCache,
): number {
	if (index <= 0) return 0;

	if (typeof estimateSize === "number") {
		return index * Math.max(0, estimateSize);
	}

	if (cache) {
		return cache.getItemStartOffset(index);
	}

	let offset = 0;
	for (let i = 0; i < index; i++) {
		offset += getSizeAtIndex(i, estimateSize);
	}
	return offset;
}

function getTotalSize(
	count: number,
	estimateSize: number | ((index: number) => number),
	cache?: OffsetCache,
): number {
	if (count <= 0) return 0;

	if (typeof estimateSize === "number") {
		return count * Math.max(0, estimateSize);
	}

	if (cache) {
		return cache.getTotalSize();
	}

	let total = 0;
	for (let i = 0; i < count; i++) {
		total += getSizeAtIndex(i, estimateSize);
	}
	return total;
}

function getScrollElementSize(
	el: HTMLElement | Window | Document | null,
	horizontal: boolean,
): number {
	if (!el) return 0;

	if (el instanceof Window) {
		return horizontal ?
				document.documentElement.clientWidth
			:	document.documentElement.clientHeight;
	}

	if (el instanceof Document) {
		return horizontal ?
				el.documentElement.clientWidth
			:	el.documentElement.clientHeight;
	}

	return horizontal ? el.clientWidth : el.clientHeight;
}

function getScrollElementOffset(
	el: HTMLElement | Window | Document | null,
	horizontal: boolean,
): number {
	if (!el) return 0;

	if (el instanceof Window) {
		return horizontal ? el.scrollX : el.scrollY;
	}

	if (el instanceof Document) {
		return horizontal ?
				el.documentElement.scrollLeft
			:	el.documentElement.scrollTop;
	}

	return horizontal ? el.scrollLeft : el.scrollTop;
}

function resolveScrollElement(
	el: HTMLElement | Window | Document | null,
): Element | null {
	if (!el) return null;

	if (el instanceof Window) return document.documentElement;

	if (el instanceof Document) return el.scrollingElement ?? el.documentElement;

	return el;
}

function calcRange(
	scrollOffset: number,
	viewportSize: number,
	totalSize: number,
	count: number,
	estimateSize: number | ((index: number) => number),
	overscan: number,
	reverse: boolean,
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
		} else if (reverse) {
			startIndex = Math.max(
				0,
				Math.floor((totalSize - scrollOffset - viewportSize) / safeSize),
			);
			endIndex = Math.min(
				count - 1,
				Math.ceil((totalSize - scrollOffset) / safeSize) - 1,
			);
		} else {
			startIndex = Math.max(0, Math.floor(scrollOffset / safeSize));
			endIndex = Math.min(
				count - 1,
				Math.ceil((scrollOffset + viewportSize) / safeSize) - 1,
			);
		}
	} else if (cache) {
		if (reverse) {
			const scrollEnd = scrollOffset + viewportSize;

			startIndex = cache.findStartIndexReverse(scrollOffset, totalSize);
			endIndex = cache.findEndIndexReverse(scrollEnd, totalSize);
		} else {
			const scrollEnd = scrollOffset + viewportSize;

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

				cumFromTop += itemSize;
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

				cumOffset += itemSize;
			}

			if (!foundStart) {
				startIndex = 0;
				endIndex = -1;
			}
		}
	}

	startIndex = Math.max(0, startIndex - overscan);
	endIndex = Math.min(count - 1, endIndex + overscan);

	return { startIndex, endIndex };
}

function calcScrollToOffset(
	targetIndex: number,
	align: ScrollAlign,
	viewportSize: number,
	totalSize: number,
	currentOffset: number,
	estimateSize: number | ((index: number) => number),
	reverse: boolean,
	cache?: OffsetCache,
): number {
	const itemSize =
		cache ?
			cache.getItemSize(targetIndex)
		:	getSizeAtIndex(targetIndex, estimateSize);
	const naturalStart = getStartOffset(targetIndex, estimateSize, cache);

	const physicalStart =
		reverse ? totalSize - naturalStart - itemSize : naturalStart;
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

			if (physicalStart < currentOffset) {
				targetOffset =
					reverse ?
						Math.max(0, physicalEnd - viewportSize)
					:	physicalStart;
			} else {
				targetOffset =
					reverse ? physicalStart : (
						Math.max(0, physicalEnd - viewportSize)
					);
			}
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
	resolveScrollElement,
};
