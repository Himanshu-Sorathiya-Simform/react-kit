import type {
	DistributiveOmit,
	DistributivePartial,
} from "../../shared/stateShared/types.ts";

/** The comparison strategy for a sort key - selects which built-in comparator is used, or `custom` for a caller-supplied one. */
type SortType =
	| "numeric"
	| "alphabetical"
	| "alphanumeric"
	| "boolean"
	| "date"
	| "basic"
	| "custom";

/**
 * How a missing value (per each sort type's own definition of "missing" -
 * e.g. non-numeric for `numeric`, unparseable for `date`) is positioned
 * relative to present values.
 *
 * @remarks
 * - `"first"`/`"last"` are **absolute positions** - they never flip with
 *   sort direction, which is the entire reason to choose them over `-1`/`1`.
 * - `-1`/`1` **simulate a real extreme value** (very small / very large
 *   respectively) - unlike `"first"`/`"last"`, these DO flip with
 *   direction, exactly as a genuine value at that extreme would.
 *
 * @defaultValue `"last"`
 */
type SortUndefinedOption = "first" | "last" | -1 | 1;

/** Options shared by every sort type, regardless of comparator. */
interface BaseSortOptions {
	/**
	 * Sort direction.
	 * @defaultValue `false` (ascending)
	 */
	desc?: boolean;

	/**
	 * When set, `toggleSort` cycles asc -> desc -> asc, skipping the
	 * "remove this sort key" step it would otherwise land on after desc.
	 * @defaultValue `false`
	 */
	disableSortRemoval?: boolean;

	/**
	 * Flips the effective sort direction without changing `desc` itself -
	 * useful for a column whose "natural" order is descending (e.g. a
	 * priority field where higher should sort first by default).
	 * @defaultValue `false`
	 */
	invertSorting?: boolean;

	/** See {@link SortUndefinedOption}. */
	sortUndefined?: SortUndefinedOption;
}

/** Fields common to every {@link SortConfig}, regardless of `type`. */
interface BaseSortConfig extends BaseSortOptions {
	/** Unique identifier for this sort key - used for lookups (`getSort`, `getSortDirection`, etc.) and to distinguish sort keys in a multi-key `sorts` array. */
	id: string;

	/** Dot-separated path into each item, e.g. `"address.city"`. Falls back to `id` when omitted - so `id` alone is often enough if it already matches the field name. */
	field?: string;
}

/**
 * A single sort key's full configuration.
 *
 * @remarks
 * Each `type` has its own dedicated union arm (rather than several type
 * literals sharing one arm) so that {@link SortOptionsForType} - which
 * extracts a single type's own options via `Extract<SortConfig, { type: T }>`
 * - resolves correctly per type. Grouping literals under one arm would
 * make that extraction silently fail for every type in the group.
 */
type SortConfig = BaseSortConfig
	& (
		| { type: "numeric" }
		| { type: "boolean" }
		// dateGranularity: "day" (default) compares calendar dates, ignoring
		// time-of-day; "instant" compares exact milliseconds.
		| { type: "date"; dateGranularity?: "day" | "instant" }
		// Intentionally unsafe (raw `<`/`>`) - an escape hatch for arbitrary
		// values with no more specific comparator, not for general use.
		| { type: "basic" }
		| { type: "alphabetical"; caseSensitive?: boolean }
		| { type: "alphanumeric"; caseSensitive?: boolean }
		// compare is REQUIRED here - a `custom` sort with no compare
		// function is treated as unresolvable, same as an unknown `type`.
		| { type: "custom"; compare: (a: unknown, b: unknown) => number }
	);

/** All active sort keys, in priority order - `sorts[0]` is the primary sort, later entries only break ties left by earlier ones. */
type SortState = SortConfig[];

/**
 * A single sort type's own options, with `id`/`type`/`field` (which every
 * type shares, and which `toggleSort` already takes as separate arguments)
 * stripped out. Used to type `toggleSort`'s `options` parameter, narrowed
 * to only the options relevant to the specific `type` being toggled.
 */
type SortOptionsForType<T extends SortType> = Omit<
	Extract<SortConfig, { type: T }>,
	"id" | "type" | "field"
>;

/**
 * The update payload type for `updateSortConfig`.
 *
 * @remarks
 * Preserves per-type shape correlation at the type level - e.g. TypeScript
 * will reject `{ dateGranularity: "day" }` paired with a `type` that isn't
 * `"date"`. This is best-effort compile-time guidance, not a full
 * guarantee: a *merge* of an update into an existing config can still land
 * on a structurally invalid combination that the type system alone can't
 * catch (partial updates flatten across a union in ways whole-object
 * construction doesn't). {@link isSortConfigShapeValid}, run on the merged
 * result inside `applySortUpdate`, is the actual runtime backstop.
 */
type SortConfigUpdate = DistributivePartial<DistributiveOmit<SortConfig, "id">>;

/** Options for {@link useSort}. */
interface UseSortOptions {
	/**
	 * Defers the sort recomputation (via `useDeferredValue`) so changing
	 * `sorts` doesn't block a more urgent update. Only `sorts` is deferred -
	 * `data` is not.
	 * @defaultValue `false`
	 */
	defer?: boolean;
}

export type {
	BaseSortConfig,
	BaseSortOptions,
	SortConfig,
	SortConfigUpdate,
	SortOptionsForType,
	SortState,
	SortType,
	SortUndefinedOption,
	UseSortOptions,
};
