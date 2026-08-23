/** Bucket granularity for a `date`-type group level - see {@link GroupByDateLevel.bucket}. */
type DateBucketGranularity = "day" | "month" | "year";

/**
 * Groups by a field's raw value.
 * @remarks If the resolved value is an array (e.g. a `tags` field), the
 * item fans out into a separate group per element instead of being
 * String()-coerced into one combined key - see {@link useGrouping}'s
 * `@remarks` for details.
 */
type GroupByFieldLevel = {
	type: "field";
	/** Dot-separated path into each item, e.g. `"address.city"`. */
	field: string;
};

/** Groups by a `Date`-valued field, bucketed to day/month/year rather than exact timestamp - avoids one group per unique millisecond. */
type GroupByDateLevel = {
	type: "date";
	/** Dot-separated path into each item. */
	field: string;
	/**
	 * Bucket granularity.
	 * @defaultValue `"day"`
	 */
	bucket?: DateBucketGranularity;
};

/** Groups by a caller-supplied key function - for keys that can't be expressed as a plain field path (computed buckets, merging otherwise-distinct values into one group, etc.). */
type GroupByCustomLevel<T> = {
	type: "custom";
	/** Optional; used only to identify this level in dev warnings. */
	id?: string;
	/**
	 * Computes this item's group key(s).
	 * @remarks Return an array to fan the item out into multiple groups at
	 * this level, mirroring array-valued {@link GroupByFieldLevel}s.
	 * `null`/`undefined` places the item in the Unknown bucket. Throwing,
	 * or returning anything other than `string | string[] | null | undefined`,
	 * is treated as level misconfiguration - see {@link useGrouping}'s
	 * `@remarks`.
	 */
	getKey: (item: T) => string | string[] | null | undefined;
};

/** A single grouping level - a plain string is shorthand for `{ type: "field", field: theString }`. */
type GroupByLevel<T> =
	| string
	| GroupByFieldLevel
	| GroupByDateLevel
	| GroupByCustomLevel<T>;

/** Same union as {@link GroupByLevel} with the string shorthand already expanded - what {@link useGrouping} stores internally and returns via `activeGroupBy`. */
type NormalizedGroupByLevel<T> =
	| GroupByFieldLevel
	| GroupByDateLevel
	| GroupByCustomLevel<T>;

/** A single group, as produced by {@link useGrouping}'s `groupedArray`. */
interface Group<T> {
	/** Stable identifier for this group - e.g. the field's stringified value, or a date bucket like `"2026-08"`. Unique among sibling groups at the same level. */
	key: string;
	/** Human-readable display text. Usually equal to `key`, except for date buckets (e.g. key `"2026-08"`, label `"August 2026"`). */
	label: string;
	/** ALL items under this group, flattened across any deeper levels. */
	items: T[];
	/** Present only when there's another grouping level below this one. */
	subGroups?: Group<T>[];
}

/** Options for {@link useGrouping}. */
interface UseGroupingOptions {
	/**
	 * Defers the grouping recomputation (via `useDeferredValue`) so changing
	 * `activeGroupBy` doesn't block a more urgent update, e.g. the UI
	 * interaction that triggered the change. Only `activeGroupBy` is
	 * deferred - `items` is not.
	 *
	 * @defaultValue `false`
	 */
	defer?: boolean;

	/**
	 * Display label for the synthetic bucket holding items whose value at a
	 * given level is missing, blank, or otherwise unresolvable.
	 *
	 * @defaultValue `"Unknown"`
	 */
	unknownGroupLabel?: string;

	/**
	 * Display label for the single synthetic group returned when
	 * `activeGroupBy` is empty (no grouping applied).
	 *
	 * @defaultValue `"Ungrouped"`
	 */
	ungroupedGroupLabel?: string;
}

export type {
	DateBucketGranularity,
	Group,
	GroupByCustomLevel,
	GroupByDateLevel,
	GroupByFieldLevel,
	GroupByLevel,
	NormalizedGroupByLevel,
	UseGroupingOptions,
};
