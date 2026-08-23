import {
	type DateInput,
	isDate,
	isValid,
	toDate,
} from "@himanshu-sorathiya/datetime";

/** A `{ min, max }` range value, as used by `between`-style filter operators. */
type MinMaxRange = { min: unknown; max: unknown };

/**
 * True for anything `toDate` can meaningfully attempt to parse - a real
 * `Date`, or a `string`/`number` that might represent one.
 *
 * @remarks
 * This is a type-shape check only, not a validity check - a string like
 * `"not a date"` passes here but still resolves to an Invalid Date once
 * actually parsed. Use {@link toComparableDate} when you need a real,
 * valid `Date` back.
 */
function isDateLike(value: unknown): value is string | number | Date {
	return isDate(value) || typeof value === "string" || typeof value === "number";
}

/**
 * Type guard for a whole number - any integer, positive, negative, or zero.
 *
 * @remarks
 * Rejects non-numbers, decimals, `NaN`, and `Infinity`. Unlike
 * {@link isPositiveInteger}, negative values pass - callers that use this
 * for array-style indexing (e.g. `useOrder`) typically treat a negative
 * result as "counted from the end," not as invalid input in its own right.
 */
function isInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value);
}

/** Structural check for a {@link MinMaxRange} - rejects arrays/`null` (both of which pass a naive `typeof value === "object"` check) and requires both `min`/`max` keys to be present, without checking their value types. */
function isMinMaxRange(value: unknown): value is MinMaxRange {
	return (
		typeof value === "object"
		&& value !== null
		&& !Array.isArray(value)
		&& "min" in value
		&& "max" in value
	);
}

/**
 * True only for `null`/`undefined`. The single, shared definition of
 * "nothing was provided," used throughout this library so every hook
 * agrees on what counts as missing data.
 */
function isNullish(value: unknown): value is null | undefined {
	return value === null || value === undefined;
}

/** Type guard for a valid page number or page size - whole numbers `>= 1`. Rejects `0`, negatives, decimals, `NaN`, `Infinity`, and non-numbers. */
function isPositiveInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/**
 * Type guard for a `string` or `number` - the two primitive types this
 * library accepts as a raw id wherever a hook lets a caller pass either an
 * id directly or a full item (`itemOrId`-style parameters).
 */
function isStringOrNumber(value: unknown): value is string | number {
	return typeof value === "string" || typeof value === "number";
}

/**
 * True for primitives that can be meaningfully `String()`-coerced for a
 * text comparison (`contains`, `equals`, etc.) without producing a
 * misleading result.
 *
 * @remarks
 * Deliberately excludes objects and arrays - `String()`-coercing those
 * produces `"[object Object]"` or a comma-joined list, which would silently
 * match/fail-to-match in ways that have nothing to do with the field's
 * actual content. A bad `field` path resolving to a nested object should
 * be treated as "not comparable," not stringified.
 */
function isTextComparable(value: unknown): value is string | number | boolean {
	return (
		typeof value === "string"
		|| typeof value === "number"
		|| typeof value === "boolean"
	);
}

/**
 * Coerces to a boolean, or `null` if that's not meaningfully possible.
 *
 * @remarks
 * Tolerates common on-the-wire representations in addition to real
 * booleans - `"true"`/`"false"`/`"1"`/`"0"` strings (case/whitespace
 * insensitive), and numeric `1`/`0`. Everything else (including other
 * numbers, and unrecognized strings) is "can't tell" rather than being
 * folded through `Boolean(...)`, which would make `0`, `""`, and `NaN` all
 * indistinguishable from an explicit `false`.
 */
function toBooleanOrNull(value: unknown): boolean | null {
	if (isNullish(value)) return null;

	if (typeof value === "boolean") return value;

	if (typeof value === "number") {
		if (value === 1) return true;
		if (value === 0) return false;

		return null;
	}

	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();

		if (normalized === "true" || normalized === "1") return true;
		if (normalized === "false" || normalized === "0") return false;

		return null;
	}

	return null;
}

/**
 * Parses to a valid `Date`, or `null` if that's not possible.
 *
 * @remarks
 * Missing input is rejected up front; all actual parsing/validity logic is
 * delegated to `@himanshu-sorathiya/datetime` - `toDate()` gracefully
 * degrades unparseable input to an Invalid Date rather than throwing, and
 * `isValid()` flags it. Nothing here reimplements what the library already
 * guarantees.
 */
function toComparableDate(value: unknown): Date | null {
	if (isNullish(value)) return null;

	const date = toDate(value as DateInput);

	return isValid(date) ? date : null;
}

/**
 * Coerces to a comparable string, or `null` if that's not meaningfully
 * possible.
 *
 * @remarks
 * Excludes objects/arrays for the same reason as {@link isTextComparable} -
 * `String()`-coercing a nested object or array produces `"[object Object]"`
 * or a comma-joined list, which would sort/compare in a way that has
 * nothing to do with the field's actual content. Used for
 * alphabetical/alphanumeric-style comparisons, where any primitive
 * (including numbers and booleans) is a legitimate, sortable value.
 */
function toComparableString(value: unknown): string | null {
	if (isNullish(value)) return null;
	if (typeof value === "object") return null;

	return String(value);
}

/**
 * Coerces to a finite number, or `null` if that's not meaningfully possible.
 *
 * @remarks
 * Rejects several cases native `Number()` would otherwise silently accept:
 * missing values, `NaN`, booleans (`Number(true)` is `1`, which would
 * otherwise let a boolean field silently participate in numeric
 * comparisons), and blank/whitespace-only strings (`Number("   ")` is
 * natively `0`, which isn't a real `0`). `Infinity`/`-Infinity` are
 * intentionally allowed through, to support open-ended numeric data (e.g.
 * an "unlimited" field).
 */
function toFiniteNumber(value: unknown): number | null {
	if (isNullish(value) || typeof value === "boolean") return null;
	if (typeof value !== "number" && typeof value !== "string") return null;
	if (typeof value === "string" && value.trim() === "") return null;

	const num = Number(value);

	return Number.isNaN(num) ? null : num;
}

export {
	isDateLike,
	isInteger,
	isMinMaxRange,
	isNullish,
	isPositiveInteger,
	isStringOrNumber,
	isTextComparable,
	toBooleanOrNull,
	toComparableDate,
	toComparableString,
	toFiniteNumber,
};
