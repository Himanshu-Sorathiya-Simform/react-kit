import { OffsetCache } from "./offsetCache.ts";
import type { Axis } from "./types.ts";

/**
 * Resolves a single item's size from `estimateSize`, whether it's a
 * constant or a per-index function. Guards against non-finite or negative
 * results by clamping to `0`.
 *
 * @param index - Index to size.
 * @param estimateSize - A constant size for every item, or a function called with `index`.
 */
function getSizeAtIndex(
	index: number,
	estimateSize: number | ((index: number) => number),
): number {
	const raw =
		typeof estimateSize === "function" ? estimateSize(index) : estimateSize;
	const size = Number(raw);

	return Number.isFinite(size) && size >= 0 ? size : 0;
}

/**
 * The cumulative start position of `index`, in natural (index-ascending)
 * coordinate space.
 *
 * @remarks
 * Three strategies, in priority order: a closed-form multiplication when
 * `estimateSize` is a constant (O(1), with `gap` folded in as
 * `index * (size + gap)`); a direct lookup when an {@link OffsetCache} is
 * supplied (fast, and already gap-aware internally); otherwise a linear
 * accumulation over `estimateSize` (O(index)) - this last path is what
 * backs the virtualization hooks before a cache has been built, and is
 * also usable standalone.
 *
 * @param index - `<= 0` returns `0` unconditionally.
 * @param estimateSize - A constant size for every item, or a function called per-index.
 * @param cache - An {@link OffsetCache} to prefer over recomputing, when `estimateSize` is a function.
 * @param gap - Space between consecutive items, applied whether or not a `cache` is supplied.
 * @defaultValue gap `0`
 */
function getStartOffset(
	index: number,
	estimateSize: number | ((index: number) => number),
	cache?: OffsetCache,
	gap: number = 0,
): number {
	if (index <= 0) return 0;

	const safeGap = Math.max(0, gap);

	if (typeof estimateSize === "number") {
		return index * (Math.max(0, estimateSize) + safeGap);
	}

	if (cache) {
		return cache.getItemStartOffset(index);
	}

	let offset = 0;

	for (let i = 0; i < index; i++) {
		offset += getSizeAtIndex(i, estimateSize) + safeGap;
	}

	return offset;
}

/**
 * Total size of all `count` items plus the gaps between them.
 *
 * @param count - `<= 0` returns `0`.
 * @param estimateSize - A constant size for every item, or a function called per-index.
 * @param cache - An {@link OffsetCache} to prefer over recomputing, when `estimateSize` is a function.
 * @param gap - Space between consecutive items (not after the last one).
 * @defaultValue gap `0`
 */
function getTotalSize(
	count: number,
	estimateSize: number | ((index: number) => number),
	cache?: OffsetCache,
	gap: number = 0,
): number {
	if (count <= 0) return 0;

	const safeGap = Math.max(0, gap);

	if (typeof estimateSize === "number") {
		return count * Math.max(0, estimateSize) + (count - 1) * safeGap;
	}

	if (cache) {
		return cache.getTotalSize();
	}

	let total = 0;

	for (let i = 0; i < count; i++) {
		total += getSizeAtIndex(i, estimateSize);
	}

	return total + (count - 1) * safeGap;
}

/**
 * The scrollable viewport's size along `axis` - `clientHeight`/`clientWidth`
 * for an element, or the equivalent for `Window`/`Document` (which excludes
 * the scrollbar, unlike `window.innerWidth`/`innerHeight`).
 *
 * @param el - `null` returns `0` (useful before a scroll ref/getter resolves).
 * @param axis - Which dimension to read.
 */
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

/**
 * The scrollable element's current scroll position along `axis` -
 * `scrollTop`/`scrollLeft` for an element, or the `Window`/`Document`
 * equivalent.
 *
 * @remarks
 * Returns the *raw* browser value - callers that need to account for RTL
 * (where `scrollLeft` can be negative) or a `scrollMargin` do that
 * normalization themselves on top of this.
 *
 * @param el - `null` returns `0`.
 * @param axis - Which dimension to read.
 */
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

/**
 * Resolves any accepted scroll target down to a concrete `Element` that
 * `.scrollTo()` can be called on directly - lets call sites make one
 * uniform `Element.scrollTo()` call regardless of whether the original
 * target was a `Window`, `Document`, or `Element`.
 *
 * @param el - `null` returns `null`.
 */
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
	resolveScrollElement
};

