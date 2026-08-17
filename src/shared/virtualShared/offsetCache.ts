/**
 * Maintains cumulative start-offsets for a sequence of variably-sized items
 * (list indices, or one axis of a grid), so "what index is at this scroll
 * position" and "what's this index's start position" can both be answered
 * in O(log n) / O(1) instead of re-summing sizes from the start every time.
 *
 * @remarks
 * Internally, offsets are stored as a single cumulative `Float64Array` of
 * length `count + 1`, where `offsets[i]` is item `i`'s start position and
 * `offsets[count]` is the total size. `gap` (space between consecutive
 * items) is baked directly into these cumulative offsets rather than added
 * on separately - this is what lets {@link findStartIndex}/{@link findEndIndex}
 * (and the reverse-mode equivalents) stay simple binary searches over the
 * offsets array, oblivious to `gap`, while still correctly mapping a real
 * (gap-inclusive) scroll position to an index. Because of this, methods
 * that return an *item's own size* (like {@link getItemSize}) explicitly
 * subtract the trailing gap back out - the raw cumulative delta between two
 * offsets is "item size + gap", not just "item size".
 *
 * Not itself aware of `reverse` layouts - callers translate between this
 * cache's natural (index-ascending) offsets and physical (viewport)
 * position, using {@link getPhysicalStartReverse} and the two
 * `find*Reverse` methods as the translation points.
 */
class OffsetCache {
	/** Cumulative offsets, length `count + 1`. See the class remarks for what each entry means. */
	private _offsets: Float64Array = new Float64Array(0);
	/** Number of items currently sized by this cache. */
	private _count: number = 0;
	/** Space between consecutive items, as last set by {@link initializeOffsets}. */
	private _gap: number = 0;

	/**
	 * (Re)builds the cache from scratch by calling `estimateSize` once for
	 * every index, `0` through `count - 1`, in ascending order. O(n).
	 *
	 * @param count - Number of items to size.
	 * @param estimateSize - Called once per index to get that item's size. A non-finite or negative result is treated as `0`.
	 * @param gap - Space added between consecutive items (not after the last one). Negative values are clamped to `0`.
	 * @defaultValue gap `0`
	 */
	initializeOffsets(
		count: number,
		estimateSize: (index: number) => number,
		gap: number = 0,
	): void {
		this._count = count;
		this._gap = Math.max(0, gap);
		this._offsets = new Float64Array(count + 1);

		let cumulative = 0;

		for (let i = 0; i < count; i++) {
			this._offsets[i] = cumulative;

			const raw = estimateSize(i);
			const size = Number.isFinite(raw) && raw >= 0 ? raw : 0;

			cumulative += size + (i < count - 1 ? this._gap : 0);
		}

		this._offsets[count] = cumulative;
	}

	/**
	 * The cumulative start position of item `index` (`0` for the first
	 * item), in the cache's natural (index-ascending, gap-inclusive)
	 * coordinate space.
	 *
	 * @param index - Clamped into `[0, count]`; `count` (one past the last item) returns the total size.
	 */
	getItemStartOffset(index: number): number {
		if (index <= 0) return 0;

		if (index >= this._count) return this._offsets[this._count] ?? 0;

		return this._offsets[index] ?? 0;
	}

	/**
	 * The item's own rendered size - excludes its trailing gap, unlike the
	 * raw cumulative delta between two offsets (which is "size + gap").
	 *
	 * @param index - Returns `0` when out of range (`< 0` or `>= count`).
	 */
	getItemSize(index: number): number {
		if (index < 0 || index >= this._count) return 0;

		const trailingGap = index < this._count - 1 ? this._gap : 0;

		return (
			(this._offsets[index + 1] ?? 0)
			- (this._offsets[index] ?? 0)
			- trailingGap
		);
	}

	/** Total size of all items plus the gaps between them (but not a trailing gap after the last item). */
	getTotalSize(): number {
		return this._offsets[this._count] ?? 0;
	}

	/**
	 * Batched measurement update: applies any number of `{index: newSize}`
	 * pairs in a single O(n) pass from the earliest changed index onward,
	 * instead of one O(n) shift per item (see {@link updateItemSize} below
	 * for the single-item equivalent this replaces for bulk use).
	 *
	 * @param measurements - Map of index to newly measured size. Indices outside `[0, count)` are ignored; non-finite or negative sizes are treated as `0`.
	 * @returns Whether anything actually changed, so callers can skip a re-render when measured sizes matched the estimates.
	 */
	applyMeasurements(measurements: ReadonlyMap<number, number>): boolean {
		if (measurements.size === 0 || this._count === 0) return false;

		let minIndex = this._count;

		for (const index of measurements.keys()) {
			if (index >= 0 && index < this._count && index < minIndex) {
				minIndex = index;
			}
		}

		if (minIndex >= this._count) return false;

		let changed = false;
		let cumulative = this._offsets[minIndex] ?? 0;

		for (let i = minIndex; i < this._count; i++) {
			const trailingGap = i < this._count - 1 ? this._gap : 0;
			const originalSize =
				(this._offsets[i + 1] ?? 0) - (this._offsets[i] ?? 0) - trailingGap;
			const measured = measurements.get(i);
			const size =
				measured !== undefined ?
					Number.isFinite(measured) && measured >= 0 ?
						measured
					:	0
				:	originalSize;

			if ((this._offsets[i] ?? 0) !== cumulative) changed = true;
			if (size !== originalSize) changed = true;

			this._offsets[i] = cumulative;
			cumulative += size + trailingGap;
		}

		if ((this._offsets[this._count] ?? 0) !== cumulative) changed = true;
		this._offsets[this._count] = cumulative;

		return changed;
	}

	/**
	 * Updates a single item's size, shifting every subsequent offset by the
	 * delta. O(n) per call - prefer {@link applyMeasurements} when updating
	 * more than one index at a time, since that batches the shift into a
	 * single O(n) pass instead of one per call.
	 *
	 * @param index - No-op when out of range (`< 0` or `>= count`).
	 * @param newSize - A non-finite or negative value is treated as `0`.
	 */
	updateItemSize(index: number, newSize: number): void {
		if (index < 0 || index >= this._count) return;

		const safeSize = Number.isFinite(newSize) && newSize >= 0 ? newSize : 0;
		const oldSize = this.getItemSize(index);
		const delta = safeSize - oldSize;

		if (delta === 0) return;

		for (let i = index + 1; i <= this._count; i++) {
			this._offsets[i] = (this._offsets[i] ?? 0) + delta;
		}
	}

	/**
	 * Binary search for the smallest index whose item extends past
	 * `scrollOffset` - i.e. the first (numerically lowest) visible index,
	 * for a non-`reverse` layout.
	 *
	 * @param scrollOffset - Leading edge of the viewport, in this cache's natural coordinate space.
	 */
	findStartIndex(scrollOffset: number): number {
		if (this._count === 0) return 0;

		let low = 0;
		let high = this._count - 1;

		while (low < high) {
			const mid = (low + high) >>> 1;
			const itemEnd = this._offsets[mid + 1] ?? 0;

			if (itemEnd <= scrollOffset) {
				low = mid + 1;
			} else {
				high = mid;
			}
		}

		return low;
	}

	/**
	 * Binary search for the largest index whose item starts before
	 * `scrollEnd` - i.e. the last (numerically highest) visible index, for
	 * a non-`reverse` layout.
	 *
	 * @param scrollEnd - Trailing edge of the viewport (`scrollOffset + viewportSize`), in this cache's natural coordinate space.
	 */
	findEndIndex(scrollEnd: number): number {
		if (this._count === 0) return -1;

		let low = 0;
		let high = this._count - 1;

		while (low < high) {
			const mid = ((low + high) >>> 1) + 1;
			const itemStart = this._offsets[mid] ?? 0;

			if (itemStart < scrollEnd) {
				low = mid;
			} else {
				high = mid - 1;
			}
		}

		return low;
	}

	/**
	 * The item's physical leading edge when rendered in a `reverse` layout
	 * (where index `0` sits at the physical trailing end and `count - 1`
	 * sits at the physical leading end) - excludes the item's own trailing
	 * gap, matching {@link getItemSize}.
	 *
	 * @param index - Index to translate.
	 * @param totalSize - The cache's current {@link getTotalSize}, passed in rather than recomputed since callers typically already have it on hand.
	 */
	getPhysicalStartReverse(index: number, totalSize: number): number {
		const naturalEnd = (this._offsets[index] ?? 0) + this.getItemSize(index);

		return totalSize - naturalEnd;
	}

	/**
	 * Binary search for the numerically-largest visible index in a
	 * `reverse` layout - physically the *topmost/leading* visible item,
	 * since index order runs opposite to physical position in reverse mode.
	 *
	 * @remarks
	 * Pair with {@link findBottomIndexReverse} to get a full visible range:
	 * `startIndex = findBottomIndexReverse(scrollEnd, totalSize)`,
	 * `endIndex = findTopIndexReverse(scrollOffset, totalSize)` - note which
	 * query feeds which variable. Assigning them the other way around
	 * produces an inverted (and effectively empty) range.
	 *
	 * @param scrollOffset - Leading edge of the viewport, in this cache's natural coordinate space.
	 * @param totalSize - The cache's current {@link getTotalSize}.
	 */
	findTopIndexReverse(scrollOffset: number, totalSize: number): number {
		if (this._count === 0) return 0;

		const threshold = totalSize - scrollOffset;

		let low = 0;
		let high = this._count - 1;

		while (low < high) {
			const mid = ((low + high) >>> 1) + 1;
			const naturalStart = this._offsets[mid] ?? 0;

			if (naturalStart < threshold) {
				low = mid;
			} else {
				high = mid - 1;
			}
		}

		const naturalStartLo = this._offsets[low] ?? 0;

		if (naturalStartLo >= threshold) return 0;

		return low;
	}

	/**
	 * Binary search for the numerically-smallest visible index in a
	 * `reverse` layout - physically the *bottommost/trailing* visible item.
	 * See {@link findTopIndexReverse} for how the two pair together.
	 *
	 * @param scrollEnd - Trailing edge of the viewport (`scrollOffset + viewportSize`), in this cache's natural coordinate space.
	 * @param totalSize - The cache's current {@link getTotalSize}.
	 */
	findBottomIndexReverse(scrollEnd: number, totalSize: number): number {
		if (this._count === 0) return -1;

		const threshold = totalSize - scrollEnd;

		let low = 0;
		let high = this._count - 1;

		while (low < high) {
			const mid = (low + high) >>> 1;
			const naturalEnd = this._offsets[mid + 1] ?? 0;

			if (naturalEnd > threshold) {
				high = mid;
			} else {
				low = mid + 1;
			}
		}

		const naturalEndLo = this._offsets[low + 1] ?? 0;

		if (naturalEndLo <= threshold) return -1;

		return low;
	}
}

export { OffsetCache };
