// Coerces to a whole number >= 1, or `undefined` if the input can't be
// made into one — used for `maxSize`, where there's no sensible numeric
// fallback to clamp to.
function resolvePositiveInteger(value: number | undefined): number | undefined {
	if (value === undefined) return undefined;

	const num = Math.floor(Number(value));

	return Number.isFinite(num) && num >= 1 ? num : undefined;
}

// Same idea for `maxWait`/`quietPeriod`, where `0` is a valid value
// (flush constantly) but negative/non-finite input isn't.
function resolveNonNegativeNumber(value: number | undefined): number | undefined {
	if (value === undefined) return undefined;

	const num = Number(value);

	return Number.isFinite(num) && num >= 0 ? num : undefined;
}

export { resolveNonNegativeNumber, resolvePositiveInteger };
