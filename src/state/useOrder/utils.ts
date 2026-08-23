/**
 * Resolves a possibly-negative index into its equivalent non-negative
 * position, Python/`Array.prototype.at`-style - `-1` means the last item,
 * `-2` the second-to-last, and so on.
 *
 * @remarks
 * Purely arithmetic - the result isn't clamped or bounds-checked against
 * `length` here (a still-negative or still-too-large result is left for the
 * caller to catch), so this stays a single, simple, always-correct
 * conversion step, reusable regardless of how each caller wants to handle
 * an out-of-range result.
 *
 * @param index - The index to resolve, positive or negative.
 * @param length - The array's current length.
 * @returns The equivalent non-negative index, if `index` was negative; otherwise `index` unchanged.
 */
function normalizeIndex(index: number, length: number): number {
	return index < 0 ? length + index : index;
}

export { normalizeIndex };
