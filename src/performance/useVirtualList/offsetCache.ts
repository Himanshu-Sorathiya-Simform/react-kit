class OffsetCache {
	private _offsets: Float64Array = new Float64Array(0);
	private _count: number = 0;

	initializeOffsets(count: number, estimateSize: (index: number) => number): void {
		this._count = count;
		this._offsets = new Float64Array(count + 1);

		let cumulative = 0;

		for (let i = 0; i < count; i++) {
			this._offsets[i] = cumulative;

			const raw = estimateSize(i);
			const size = Number.isFinite(raw) && raw >= 0 ? raw : 0;

			cumulative += size;
		}

		this._offsets[count] = cumulative;
	}

	getItemStartOffset(index: number): number {
		if (index <= 0) return 0;

		if (index >= this._count) return this._offsets[this._count] ?? 0;

		return this._offsets[index] ?? 0;
	}

	getItemSize(index: number): number {
		if (index < 0 || index >= this._count) return 0;

		return (this._offsets[index + 1] ?? 0) - (this._offsets[index] ?? 0);
	}

	getTotalSize(): number {
		return this._offsets[this._count] ?? 0;
	}

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

	getPhysicalStartReverse(index: number, totalSize: number): number {
		const naturalEnd = this._offsets[index + 1] ?? 0;

		return totalSize - naturalEnd;
	}

	findStartIndexReverse(scrollOffset: number, totalSize: number): number {
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

	findEndIndexReverse(scrollEnd: number, totalSize: number): number {
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
