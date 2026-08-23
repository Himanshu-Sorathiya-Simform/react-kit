import { startOfDay } from "@himanshu-sorathiya/datetime";
import {
	isNullish,
	toBooleanOrNull,
	toComparableDate,
	toComparableString,
	toFiniteNumber,
} from "../../shared/stateShared/coercion.ts";
import type { SortConfig, SortUndefinedOption } from "./types.ts";

/**
 * Raw numeric comparator - assumes both inputs are already coerced (see
 * {@link toFiniteNumber}). Missing-value handling and direction are applied
 * one layer up, by {@link makeComparator}.
 */
function compareNumbers(a: number, b: number): number {
	if (a === b) return 0;

	// Sign check, not subtraction -- a - b is NaN when both sides are
	// Infinity (a real, valid value toFiniteNumber lets through for
	// open-ended numeric data), and a comparator returning NaN is
	// unspecified behavior per the Array.prototype.sort spec.
	return a < b ? -1 : 1;
}

/** Raw boolean comparator - `false` sorts before `true`. */
function compareBooleans(a: boolean, b: boolean): number {
	if (a === b) return 0;

	return a ? 1 : -1;
}

/**
 * Raw date comparator.
 * @param granularity - `"day"` compares calendar dates, ignoring
 * time-of-day; `"instant"` compares exact milliseconds.
 * @defaultValue granularity `"day"`
 */
function compareDates(
	a: Date,
	b: Date,
	granularity: "day" | "instant" = "day",
): number {
	if (granularity === "instant") return a.getTime() - b.getTime();

	return startOfDay(a).getTime() - startOfDay(b).getTime();
}

/** Locale-aware string comparator, via `Intl`-backed `localeCompare`. @param caseSensitive - `false` (default) compares case-insensitively. */
function compareAlphabetical(a: string, b: string, caseSensitive = false): number {
	return a.localeCompare(b, undefined, {
		sensitivity: caseSensitive ? "variant" : "base",
	});
}

/** Same as {@link compareAlphabetical}, but with `numeric: true` - so embedded numbers compare by value (`"item2"` before `"item10"`) rather than lexicographically. */
function compareAlphanumeric(a: string, b: string, caseSensitive = false): number {
	return a.localeCompare(b, undefined, {
		numeric: true,
		sensitivity: caseSensitive ? "variant" : "base",
	});
}

// Intentionally unsafe (raw `<`/`>` via `any`) - "basic" exists specifically
// as an escape hatch for arbitrary values with no more specific comparator
// and no meaningful type to narrow to. Kept as `any` on purpose, not
// oversight - typeof-branching here would just be solving a problem this
// type's entire purpose is to avoid.
/** Raw fallback comparator for the `basic` sort type - native `<`/`>`, no type narrowing. */
function compareBasic(a: unknown, b: unknown): number {
	return (
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(a as any) < (b as any) ? -1
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		: (a as any) > (b as any) ? 1
		: 0
	);
}

/** Delegates directly to a `custom` sort's caller-supplied `compare` function. */
function compareCustom(
	a: unknown,
	b: unknown,
	compare: (a: unknown, b: unknown) => number,
): number {
	return compare(a, b);
}

/**
 * Final, already direction-adjusted comparison result when exactly one of
 * two values is missing. Caller guarantees this is only invoked in that
 * exact case - both-missing and neither-missing are handled by
 * {@link makeComparator} before this is ever called.
 *
 * @remarks
 * `"first"`/`"last"` are absolute positions and never flip with sort
 * direction - that's the entire reason to choose them over `-1`/`1`.
 * `-1`/`1` simulate a real extreme value (very small / very large), so they
 * DO flip with direction, exactly as a genuine value at that extreme
 * would. See {@link SortUndefinedOption}.
 *
 * @param aMissing - Whether `a` (not `b`) is the missing one.
 * @param effectiveDesc - `desc !== invertSorting`, the sort key's true effective direction.
 */
function compareMissingValues(
	aMissing: boolean,
	option: SortUndefinedOption = "last",
	effectiveDesc: boolean,
): number {
	if (option === "first") return aMissing ? -1 : 1;
	if (option === "last") return aMissing ? 1 : -1;

	const missingIsSmall = option === -1;
	const ascendingResult =
		missingIsSmall ?
			aMissing ? -1
			:	1
		: aMissing ? 1
		: -1;

	return effectiveDesc ? -ascendingResult : ascendingResult;
}

/**
 * Wraps a type-specific normalizer + raw comparator into one function that
 * handles missing-value positioning and direction inversion exactly once -
 * so every sort type shares identical semantics instead of each
 * reimplementing (and risking drifting on) the same logic.
 *
 * @param normalize - Coerces a raw value to the comparator's expected type, or `null` if that's not possible (treated as "missing").
 * @param compare - Raw comparator for two already-normalized, present values.
 * @param sortUndefined - See {@link SortUndefinedOption}.
 * @param effectiveDesc - `desc !== invertSorting`.
 * @returns A comparator over raw, unnormalized values - ready to hand to `Array.prototype.sort`.
 */
function makeComparator<TNorm>(
	normalize: (value: unknown) => TNorm | null,
	compare: (a: TNorm, b: TNorm) => number,
	sortUndefined: SortUndefinedOption | undefined,
	effectiveDesc: boolean,
): (valueA: unknown, valueB: unknown) => number {
	return (valueA, valueB) => {
		const a = normalize(valueA);
		const b = normalize(valueB);

		if (a === null || b === null) {
			if (a === null && b === null) return 0;

			return compareMissingValues(a === null, sortUndefined, effectiveDesc);
		}

		const result = compare(a, b);

		if (result === 0) return 0;

		return effectiveDesc ? -result : result;
	};
}

/**
 * Resolves a {@link SortConfig} into a single ready-to-call comparator,
 * computed once per sort key rather than once per pairwise comparison
 * during the sort itself.
 *
 * @remarks
 * Returns `undefined` (rather than throwing itself) for an unrecognized
 * `type`, or a `custom` sort with no `compare` function - even though
 * `compare` is required at the type level for `custom`, it's re-checked
 * here at runtime, since a plain-JS caller can bypass that guarantee.
 * Callers (`useSort`) are responsible for the dev-warn/throw or
 * silent-skip decision on an `undefined` result.
 *
 * @param effectiveDesc - `desc !== invertSorting` - the sort key's true effective direction, already resolved once by the caller.
 * @returns A comparator over raw values, or `undefined` if `sortConfig` couldn't be resolved.
 */
function createSortComparator(
	sortConfig: SortConfig,
	effectiveDesc: boolean,
): ((valueA: unknown, valueB: unknown) => number) | undefined {
	const { type, sortUndefined } = sortConfig;

	switch (type) {
		case "numeric":
			return makeComparator(
				toFiniteNumber,
				compareNumbers,
				sortUndefined,
				effectiveDesc,
			);

		case "boolean":
			return makeComparator(
				toBooleanOrNull,
				compareBooleans,
				sortUndefined,
				effectiveDesc,
			);

		case "date": {
			const granularity = sortConfig.dateGranularity ?? "day";

			return makeComparator(
				toComparableDate,
				(a, b) => compareDates(a, b, granularity),
				sortUndefined,
				effectiveDesc,
			);
		}

		case "alphabetical": {
			const caseSensitive = sortConfig.caseSensitive ?? false;

			return makeComparator(
				toComparableString,
				(a, b) => compareAlphabetical(a, b, caseSensitive),
				sortUndefined,
				effectiveDesc,
			);
		}

		case "alphanumeric": {
			const caseSensitive = sortConfig.caseSensitive ?? false;

			return makeComparator(
				toComparableString,
				(a, b) => compareAlphanumeric(a, b, caseSensitive),
				sortUndefined,
				effectiveDesc,
			);
		}

		case "basic":
			return makeComparator(
				(v) => (isNullish(v) ? null : v),
				compareBasic,
				sortUndefined,
				effectiveDesc,
			);

		case "custom": {
			const { compare } = sortConfig;

			if (typeof compare !== "function") return undefined;

			return makeComparator(
				(v) => (isNullish(v) ? null : v),
				(a, b) => compareCustom(a, b, compare),
				sortUndefined,
				effectiveDesc,
			);
		}

		default:
			return undefined;
	}
}

export {
	compareAlphabetical,
	compareAlphanumeric,
	compareBasic,
	compareBooleans,
	compareCustom,
	compareDates,
	compareMissingValues,
	compareNumbers,
	createSortComparator,
};
