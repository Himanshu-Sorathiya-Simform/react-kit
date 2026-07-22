import { OffsetCache } from "./offsetCache.ts";
import type { Axis } from "./types.ts";

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
	axis: Axis,
): number {
	if (!el) return 0;

	const isVertical = axis === "vertical";

	if (el instanceof Window) {
		return isVertical ?
				document.documentElement.clientHeight
			:	document.documentElement.clientWidth;
	}

	if (el instanceof Document) {
		return isVertical ?
				el.documentElement.clientHeight
			:	el.documentElement.clientWidth;
	}

	return isVertical ? el.clientHeight : el.clientWidth;
}

function getScrollElementOffset(
	el: HTMLElement | Window | Document | null,
	axis: Axis,
): number {
	if (!el) return 0;

	const isVertical = axis === "vertical";

	if (el instanceof Window) {
		return isVertical ? el.scrollY : el.scrollX;
	}

	if (el instanceof Document) {
		return isVertical ?
				el.documentElement.scrollTop
			:	el.documentElement.scrollLeft;
	}

	return isVertical ? el.scrollTop : el.scrollLeft;
}

function resolveScrollElement(
	el: HTMLElement | Window | Document | null,
): Element | null {
	if (!el) return null;

	if (el instanceof Window) return document.documentElement;

	if (el instanceof Document) return el.scrollingElement ?? el.documentElement;

	return el;
}

export {
	getScrollElementOffset,
	getScrollElementSize,
	getSizeAtIndex,
	getStartOffset,
	getTotalSize,
	resolveScrollElement,
};
