import type {
	DistributiveOmit,
	DistributivePartial,
} from "../../shared/stateShared/types.ts";

/** The comparison strategy for a filter - selects which operator set (`text`, `number`, etc.) applies, or `custom` for a caller-supplied predicate. */
type FilterType =
	| "text"
	| "number"
	| "boolean"
	| "date"
	| "select"
	| "multiselect"
	| "custom";

/** Operators available on a `text`-type filter. */
type TextOperator =
	| "contains"
	| "equals"
	| "startsWith"
	| "endsWith"
	| "notContains";
/** Operators available on a `number`-type filter. */
type NumberOperator =
	| "equals"
	| "greaterThan"
	| "lessThan"
	| "greaterThanOrEqual"
	| "lessThanOrEqual"
	| "between";
/** Operators available on a `boolean`-type filter. */
type BooleanOperator = "equals" | "notEquals";
/** Operators available on a `date`-type filter. */
type DateOperator = "equals" | "before" | "after" | "between";
/** Operators available on a `select`-type filter (single value against a scalar field). */
type SelectOperator = "equals" | "notEquals" | "in" | "notIn";
/** Operators available on a `multiselect`-type filter (against an array-valued field). */
type MultiselectOperator = "in" | "notIn" | "intersects";
/** The sole operator for a `custom`-type filter - present for structural symmetry with the other operator unions, not because there's a real choice to make. */
type CustomOperator = "custom";

/** Options shared across filter types, though not every option is meaningful for every type. */
interface FilterOptions<T = unknown> {
	/**
	 * Case sensitivity for `text` comparisons. Ignored by every other
	 * filter type - `select` deliberately has no equivalent, since select
	 * values are enumerated tokens (a fixed options list, an HTML
	 * `<select>`), not free-typed input that could differ only by case.
	 * @defaultValue `false`
	 */
	caseSensitive?: boolean;

	/**
	 * Comparison granularity for `date` filters.
	 * `"day"` ignores time-of-day (calendar-date comparison); `"instant"`
	 * compares exact milliseconds. Ignored by every other filter type.
	 * @defaultValue `"day"`
	 */
	dateGranularity?: "day" | "instant";

	/** Required for `type: "custom"` - the predicate deciding whether an item matches. Ignored by every other filter type. */
	compare?: (itemValue: unknown, filterValue: unknown, item: T) => boolean;
}

/** Options for {@link useFilter}. */
interface UseFilterOptions {
	/**
	 * Defers the filtering recomputation (via `useDeferredValue`) so
	 * changing `filters` doesn't block a more urgent update (e.g. the
	 * keystroke that triggered the change). Only `filters` is deferred -
	 * `data` is not.
	 * @defaultValue `false`
	 */
	defer?: boolean;
}

/** Fields common to every {@link FilterConfig}, regardless of `type`/`operator`. */
type BaseFilterConfig<T> = FilterOptions<T> & {
	/** Unique identifier for this filter - used for lookups (`getFilter`, `isFilterActive`, etc.) and to distinguish filters in the `filters` array. */
	id: string;

	/** Dot-separated path into each item, e.g. `"address.city"`. Falls back to `id` when omitted - so `id` alone is often enough if it already matches the field name. */
	field?: string;

	/**
	 * Whether this filter currently participates in filtering. An inactive
	 * filter stays in the `filters` array (so its configuration - operator,
	 * value, etc. - is preserved) but is skipped during evaluation.
	 * @defaultValue `true`
	 */
	isActive?: boolean;
};

/**
 * A single filter's full configuration.
 *
 * @remarks
 * Each `type` has its own dedicated arm(s) - `number`/`date`/`select` each
 * split further by operator (a `between` arm with a `{min,max}` value,
 * separate from every other operator's scalar/array value) - rather than
 * grouping multiple type literals under one shared arm. This is what lets
 * TypeScript actually narrow `value`'s type based on `type`+`operator`,
 * and what makes {@link FilterOptionsForType}-style per-type extraction
 * (and IDE autocomplete while constructing a filter) work correctly -
 * grouping literals under one arm silently breaks both.
 */
type FilterConfig<T = unknown> = BaseFilterConfig<T>
	& (
		| { type: "text"; operator: TextOperator; value: string }
		| {
				type: "number";
				operator: "between";
				value: { min: number; max: number };
		  }
		| {
				type: "number";
				operator: Exclude<NumberOperator, "between">;
				value: number;
		  }
		| { type: "boolean"; operator: BooleanOperator; value: boolean }
		| {
				type: "date";
				operator: "between";
				value: { min: string | number | Date; max: string | number | Date };
		  }
		| {
				type: "date";
				operator: Exclude<DateOperator, "between">;
				value: string | number | Date;
		  }
		| {
				// select.in/notIn take an array of allowed values (faceted
				// search, e.g. "status is Active OR Pending") - distinct from
				// equals/notEquals, and from multiselect (where it's the
				// ITEM's own field that's an array, not the filter value).
				type: "select";
				operator: Exclude<SelectOperator, "in" | "notIn">;
				value: string | number;
		  }
		| {
				type: "select";
				operator: "in" | "notIn";
				value: (string | number)[];
		  }
		| {
				type: "multiselect";
				operator: MultiselectOperator;
				value: (string | number)[];
		  }
		| { type: "custom"; operator: CustomOperator; value: unknown }
	);

/** All configured filters. Order has no effect on filtering (every active filter is AND-combined), only on iteration order of `filters`/`groupedRecord`-style outputs elsewhere in this library. */
type FilterState<T> = FilterConfig<T>[];

/**
 * The update payload type for `updateFilterConfig`.
 *
 * @remarks
 * Best-effort compile-time guidance, not a full guarantee: a *merge* of an
 * update into an existing filter can still land on a structurally invalid
 * `type`/`operator`/`value` combination that the type system alone can't
 * catch (partial updates flatten across a union in ways whole-object
 * construction doesn't). `isValueShapeValid`, run on the merged result
 * inside `applyFilterUpdate`, is the actual runtime backstop.
 */
type FilterConfigUpdate<T> = DistributivePartial<
	DistributiveOmit<FilterConfig<T>, "id">
>;

export type {
	BooleanOperator,
	CustomOperator,
	DateOperator,
	FilterConfig,
	FilterConfigUpdate,
	FilterOptions,
	FilterState,
	FilterType,
	MultiselectOperator,
	NumberOperator,
	SelectOperator,
	TextOperator,
	UseFilterOptions,
};
