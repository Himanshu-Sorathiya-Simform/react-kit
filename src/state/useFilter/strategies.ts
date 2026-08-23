import {
	isAfter,
	isBefore,
	isEqual,
	isSameDay,
	isWithinRange,
	startOfDay,
} from "@himanshu-sorathiya/datetime";
import {
	isMinMaxRange,
	isNullish,
	isTextComparable,
	toBooleanOrNull,
	toComparableDate,
	toFiniteNumber,
} from "../../shared/stateShared/coercion.ts";
import type {
	BooleanOperator,
	DateOperator,
	MultiselectOperator,
	NumberOperator,
	SelectOperator,
	TextOperator,
} from "./types.ts";

/** Per-filter options a {@link StrategyFn} may read - the subset of {@link FilterOptions} relevant to matching, minus `compare` (custom-only, never reaches a strategy function). */
type FilterStrategyConfig = {
	caseSensitive?: boolean | undefined;
	dateGranularity?: "day" | "instant" | undefined;
};

/** A single operator's matching logic - given an item's raw value and the filter's configured value, returns whether it matches. */
type StrategyFn = (
	itemValue: unknown,
	filterValue: unknown,
	config: FilterStrategyConfig,
) => boolean;

/**
 * The full operator registry, typed against each {@link FilterType}'s real
 * operator union (not a loose `Record<string, ...>`) - a typo'd or missing
 * operator here is a compile error, not a silent runtime gap. See
 * {@link getStrategyFn} for the (necessarily string-keyed) runtime lookup
 * this enables.
 */
type FilterStrategyMap = {
	text: Record<TextOperator, StrategyFn>;
	number: Record<NumberOperator, StrategyFn>;
	boolean: Record<BooleanOperator, StrategyFn>;
	date: Record<DateOperator, StrategyFn>;
	select: Record<SelectOperator, StrategyFn>;
	multiselect: Record<MultiselectOperator, StrategyFn>;
};

/**
 * Looks up the strategy function for a given `type`/`operator` pair.
 *
 * @remarks
 * {@link FILTER_STRATEGIES} above is authored against the real per-type
 * operator unions ({@link FilterStrategyMap}), so a typo or missing
 * operator there is a compile error. This function is the one deliberate
 * trust boundary where that static guarantee meets *runtime* dispatch by a
 * plain string - which still matters, since `type`/`operator` can be wrong
 * at runtime even when TypeScript believes they can't (untyped JS
 * consumers, data read from storage/a URL/an API without revalidation).
 * Callers must handle an `undefined` result themselves (`useFilter` treats
 * it as an unresolvable filter - dev warn+throw, or exclude everything for
 * that filter in production).
 */
function getStrategyFn(type: string, operator: string): StrategyFn | undefined {
	const strategies = FILTER_STRATEGIES as unknown as Record<
		string,
		Record<string, StrategyFn> | undefined
	>;

	return strategies[type]?.[operator];
}

/**
 * Every built-in filter operator's matching logic.
 *
 * @remarks
 * One policy applies uniformly across every operator here: **missing or
 * incomparable data always excludes the item** - never the inverse. A row
 * with no value for the filtered field is treated as "unknown," not a
 * confident negative match, so even `notContains`/`notEquals`/`notIn`
 * exclude a missing value rather than including it by default. This is
 * why every operator below normalizes through a `toX`/`isXComparable`
 * helper and bails to `false` on `null`.
 */
const FILTER_STRATEGIES: FilterStrategyMap = {
	text: {
		contains: (itemVal, filterVal, config) => {
			if (!isTextComparable(itemVal) || !isTextComparable(filterVal))
				return false;

			const itemStr = String(itemVal);
			const filterStr = String(filterVal);

			if (config?.caseSensitive) return itemStr.includes(filterStr);

			return itemStr.toLowerCase().includes(filterStr.toLowerCase());
		},

		equals: (itemVal, filterVal, config) => {
			if (!isTextComparable(itemVal) || !isTextComparable(filterVal))
				return false;

			const itemStr = String(itemVal);
			const filterStr = String(filterVal);

			if (config?.caseSensitive) return itemStr === filterStr;

			return itemStr.toLowerCase() === filterStr.toLowerCase();
		},

		startsWith: (itemVal, filterVal, config) => {
			if (!isTextComparable(itemVal) || !isTextComparable(filterVal))
				return false;

			const itemStr = String(itemVal);
			const filterStr = String(filterVal);

			if (config?.caseSensitive) return itemStr.startsWith(filterStr);

			return itemStr.toLowerCase().startsWith(filterStr.toLowerCase());
		},

		endsWith: (itemVal, filterVal, config) => {
			if (!isTextComparable(itemVal) || !isTextComparable(filterVal))
				return false;

			const itemStr = String(itemVal);
			const filterStr = String(filterVal);

			if (config?.caseSensitive) return itemStr.endsWith(filterStr);

			return itemStr.toLowerCase().endsWith(filterStr.toLowerCase());
		},

		// Missing/incomparable data excludes the item here too -- NOT the
		// inverse. A row with no value is "unknown", not a confident
		// "doesn't contain X" - see the file-level @remarks above.
		notContains: (itemVal, filterVal, config) => {
			if (!isTextComparable(itemVal) || !isTextComparable(filterVal))
				return false;

			const itemStr = String(itemVal);
			const filterStr = String(filterVal);

			if (config?.caseSensitive) return !itemStr.includes(filterStr);

			return !itemStr.toLowerCase().includes(filterStr.toLowerCase());
		},
	},

	number: {
		equals: (itemVal, filterVal) => {
			const a = toFiniteNumber(itemVal);
			const b = toFiniteNumber(filterVal);

			if (a === null || b === null) return false;

			return a === b;
		},

		greaterThan: (itemVal, filterVal) => {
			const a = toFiniteNumber(itemVal);
			const b = toFiniteNumber(filterVal);

			if (a === null || b === null) return false;

			return a > b;
		},

		lessThan: (itemVal, filterVal) => {
			const a = toFiniteNumber(itemVal);
			const b = toFiniteNumber(filterVal);

			if (a === null || b === null) return false;

			return a < b;
		},

		greaterThanOrEqual: (itemVal, filterVal) => {
			const a = toFiniteNumber(itemVal);
			const b = toFiniteNumber(filterVal);

			if (a === null || b === null) return false;

			return a >= b;
		},

		lessThanOrEqual: (itemVal, filterVal) => {
			const a = toFiniteNumber(itemVal);
			const b = toFiniteNumber(filterVal);

			if (a === null || b === null) return false;

			return a <= b;
		},

		// A swapped range (min > max) is normalized rather than treated as a
		// dead range that matches nothing.
		between: (itemVal, filterVal) => {
			const item = toFiniteNumber(itemVal);

			if (item === null || !isMinMaxRange(filterVal)) return false;

			const minNum = toFiniteNumber(filterVal.min);
			const maxNum = toFiniteNumber(filterVal.max);

			if (minNum === null || maxNum === null) return false;

			const lo = Math.min(minNum, maxNum);
			const hi = Math.max(minNum, maxNum);

			return item >= lo && item <= hi;
		},
	},

	boolean: {
		equals: (itemVal, filterVal) => {
			const a = toBooleanOrNull(itemVal);
			const b = toBooleanOrNull(filterVal);

			if (a === null || b === null) return false;

			return a === b;
		},

		notEquals: (itemVal, filterVal) => {
			const a = toBooleanOrNull(itemVal);
			const b = toBooleanOrNull(filterVal);

			if (a === null || b === null) return false;

			return a !== b;
		},
	},

	date: {
		equals: (itemVal, filterVal, config) => {
			const itemDate = toComparableDate(itemVal);
			const filterDate = toComparableDate(filterVal);

			if (!itemDate || !filterDate) return false;

			const granularity = config?.dateGranularity ?? "day";

			return granularity === "instant" ?
					isEqual(itemDate, filterDate)
				:	isSameDay(itemDate, filterDate);
		},

		before: (itemVal, filterVal, config) => {
			const itemDate = toComparableDate(itemVal);
			const filterDate = toComparableDate(filterVal);

			if (!itemDate || !filterDate) return false;

			const granularity = config?.dateGranularity ?? "day";

			return granularity === "instant" ?
					isBefore(itemDate, filterDate)
				:	isBefore(startOfDay(itemDate), startOfDay(filterDate));
		},

		after: (itemVal, filterVal, config) => {
			const itemDate = toComparableDate(itemVal);
			const filterDate = toComparableDate(filterVal);

			if (!itemDate || !filterDate) return false;

			const granularity = config?.dateGranularity ?? "day";

			return granularity === "instant" ?
					isAfter(itemDate, filterDate)
				:	isAfter(startOfDay(itemDate), startOfDay(filterDate));
		},

		// Same swapped-range normalization as number.between.
		between: (itemVal, filterVal, config) => {
			const itemDate = toComparableDate(itemVal);

			if (!itemDate || !isMinMaxRange(filterVal)) return false;

			const minDate = toComparableDate(filterVal.min);
			const maxDate = toComparableDate(filterVal.max);

			if (!minDate || !maxDate) return false;

			const granularity = config?.dateGranularity ?? "day";

			if (granularity === "instant") {
				return isWithinRange(itemDate, minDate, maxDate);
			}

			return isWithinRange(
				startOfDay(itemDate),
				startOfDay(minDate),
				startOfDay(maxDate),
			);
		},
	},

	select: {
		// Loose equality so a numeric field (1) matches a string-typed HTML
		// <select> value ("1"). Missing data is excluded BEFORE the loose
		// comparison so `== null` quirks never come into play.
		equals: (itemVal, filterVal) => {
			if (isNullish(itemVal) || isNullish(filterVal)) return false;

			return itemVal == filterVal;
		},

		notEquals: (itemVal, filterVal) => {
			if (isNullish(itemVal) || isNullish(filterVal)) return false;

			return itemVal != filterVal;
		},

		in: (itemVal, filterVal) => {
			if (isNullish(itemVal) || !Array.isArray(filterVal)) return false;

			return filterVal.some((allowed) => itemVal == allowed);
		},

		notIn: (itemVal, filterVal) => {
			if (isNullish(itemVal) || !Array.isArray(filterVal)) return false;

			return !filterVal.some((allowed) => itemVal == allowed);
		},
	},

	multiselect: {
		// itemVal is a single (scalar) field value; filterVal is the set of
		// allowed selections. Strict equality here (unlike select.in) is
		// deliberate -- multiselect values already come from this library's
		// own filter UI, so they're type-consistent by construction.
		in: (itemVal, filterVal) => {
			if (isNullish(itemVal) || !Array.isArray(filterVal)) return false;

			return filterVal.includes(itemVal);
		},

		notIn: (itemVal, filterVal) => {
			if (isNullish(itemVal) || !Array.isArray(filterVal)) return false;

			return !filterVal.includes(itemVal);
		},

		// itemVal is itself an array (e.g. tags) -- both sides must be real
		// arrays or this excludes, rather than throwing on a bad `field` path.
		intersects: (itemVal, filterVal) => {
			if (isNullish(itemVal) || !Array.isArray(itemVal)) return false;
			if (isNullish(filterVal) || !Array.isArray(filterVal)) return false;

			return itemVal.some((val) => filterVal.includes(val));
		},
	},
};

export { type StrategyFn, FILTER_STRATEGIES, getStrategyFn };
