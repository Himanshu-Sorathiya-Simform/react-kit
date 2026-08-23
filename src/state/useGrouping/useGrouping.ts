import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import {
	DEFAULT_UNGROUPED_GROUP_LABEL,
	DEFAULT_UNKNOWN_GROUP_LABEL,
} from "./constants.ts";
import type {
	Group,
	GroupByLevel,
	NormalizedGroupByLevel,
	UseGroupingOptions,
} from "./types.ts";
import { computeGroupedArray } from "./utils.ts";
import {
	isLevelShapeValid,
	normalizeGroupByInput,
	warnIfDuplicateCustomIds,
} from "./validation.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/** Return value of {@link useGrouping}. */
interface UseGroupingReturn<T> {
	/** All groups, hierarchically - top-level groups from `activeGroupBy[0]`, each optionally holding `subGroups` from deeper levels. Render this for anything beyond a single flat level. */
	groupedArray: Group<T>[];

	/** Top-level groups only, flattened -- Record<key, items>. For deeper
	 * levels, traverse a group's `subGroups` directly. */
	groupedRecord: Record<string, T[]>;

	/** Top-level group keys only, in the same order as `groupedArray`. */
	groupKeys: string[];

	/** Count of top-level groups only - `groupKeys.length`. */
	totalGroups: number;

	/** The currently-applied grouping levels, normalized (string shorthand already expanded). Empty when no grouping is applied. */
	activeGroupBy: NormalizedGroupByLevel<T>[];

	/** `activeGroupBy.length > 0`. */
	hasActiveGrouping: boolean;

	/** The actual label in use for the "missing/unresolvable value" bucket - reflects `options.unknownGroupLabel` if customized, otherwise the default. Compare a group's `key` against this rather than hardcoding `"Unknown"`. */
	unknownGroupKey: string;

	/** The actual label in use for the "no grouping applied" bucket - reflects `options.ungroupedGroupLabel` if customized. Compare a group's `key` against this rather than hardcoding `"Ungrouped"`. */
	ungroupedGroupKey: string;

	/**
	 * Replaces `activeGroupBy` with one level or an array of levels (for
	 * hierarchical grouping - order determines nesting, `newGroupBy[0]`
	 * becomes the top level).
	 * @remarks A malformed level (missing `field`, non-function `getKey`,
	 * etc.) is rejected - see {@link useGrouping}'s `@remarks`.
	 */
	changeGroupBy: (newGroupBy: GroupByLevel<T> | GroupByLevel<T>[]) => void;

	/** Clears `activeGroupBy` entirely - equivalent to `changeGroupBy([])`. */
	clearGrouping: () => void;

	/** Restores `activeGroupBy` to the value passed as `initialGroupBy` at mount. Later changes to that argument have no effect - the reset target is frozen at mount. */
	resetGrouping: () => void;

	/** Looks up a single top-level group by its `key`. `undefined` if no such group exists.
	 * @remarks Top-level lookup only, matching `groupedRecord`'s scope - use `groupedArray`/`subGroups` directly for a nested group. */
	getGroup: (groupKey: string) => Group<T> | undefined;

	/** `getGroup(groupKey)?.items ?? []` - the items in a top-level group, or an empty array if it doesn't exist. */
	getGroupItems: (groupKey: string) => T[];
}

/**
 * Partitions an array into groups by one or more field values, date
 * buckets, or a custom key function - single-level or hierarchical
 * (subgroups within groups).
 *
 * @remarks
 * - **Fan-out, not partitioning.** If a level's resolved value for an item
 *   is an array (e.g. a `tags` field, or a `custom` level's `getKey`
 *   returning multiple keys), the item is placed in *every* matching group
 *   at that level, not just one. Summed item counts across sibling groups
 *   can therefore exceed the original array length - this reflects genuine
 *   multi-group membership, not a bug.
 * - **Two distinct synthetic buckets**, both customizable via
 *   {@link UseGroupingOptions}: `unknownGroupLabel` (default `"Unknown"`)
 *   for items whose value at a level is missing, blank, or otherwise
 *   unresolvable; `ungroupedGroupLabel` (default `"Ungrouped"`) for the
 *   single group returned when no grouping is applied at all. The actual
 *   labels in use are returned as `unknownGroupKey`/`ungroupedGroupKey` -
 *   compare against those rather than hardcoding the default strings, in
 *   case they've been customized.
 * - **Validation is dev/prod-split**, same convention as this library's
 *   other hooks: a malformed level (missing/empty `field`, a non-function
 *   `getKey`, an invalid `bucket`) throws immediately in development, but
 *   is rejected silently (falling back to the previous/empty grouping) in
 *   production. A `custom` level's `getKey` throwing, or returning
 *   something other than `string | string[] | null | undefined`, follows
 *   the same split - see {@link GroupByCustomLevel.getKey}.
 * - **`groupedRecord`/`groupKeys`/`totalGroups`/`getGroup`/`getGroupItems`
 *   are all top-level only** - for anything below the first grouping
 *   level, traverse a `Group`'s `subGroups` directly via `groupedArray`.
 * - Order of top-level (and each nested level's) groups follows first
 *   appearance in `items`, not any particular sort - re-sort `groupedArray`
 *   yourself if a specific order is needed.
 *
 * @typeParam T - The type of each item in `data`.
 * @param data - The items to group. Defaults to `[]`.
 * @param initialGroupBy - Grouping level(s) applied at mount. Omit for no
 * initial grouping.
 * @param options - See {@link UseGroupingOptions}.
 * @returns The current grouping and the actions to change it. See
 * {@link UseGroupingReturn}.
 *
 * @example
 * Single-level, by a plain field:
 * ```tsx
 * const { groupedArray } = useGrouping(users, "department");
 * // groupedArray: [{ key: "Engineering", items: [...] }, { key: "Sales", items: [...] }, ...]
 * ```
 *
 * @example
 * Hierarchical, by department then a date bucket:
 * ```tsx
 * const { groupedArray, changeGroupBy } = useGrouping(orders);
 *
 * changeGroupBy([
 *   "region",
 *   { type: "date", field: "placedAt", bucket: "month" },
 * ]);
 * // groupedArray: [{ key: "EMEA", items: [...], subGroups: [{ key: "2026-08", ... }] }, ...]
 * ```
 */
function useGrouping<T = unknown>(
	data: T[] = [],
	initialGroupBy?: GroupByLevel<T> | GroupByLevel<T>[],
	options?: UseGroupingOptions,
): UseGroupingReturn<T> {
	const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);

	const unknownGroupKey =
		options?.unknownGroupLabel ?? DEFAULT_UNKNOWN_GROUP_LABEL;
	const ungroupedGroupKey =
		options?.ungroupedGroupLabel ?? DEFAULT_UNGROUPED_GROUP_LABEL;

	const initialLevels = useMemo(
		() => normalizeGroupByInput(initialGroupBy),
		[initialGroupBy],
	);

	const [activeGroupBy, setActiveGroupBy] = useState<NormalizedGroupByLevel<T>[]>(
		() => {
			const invalidLevel = initialLevels.find(
				(level) => !isLevelShapeValid(level),
			);

			if (invalidLevel) {
				if (isDev) {
					console.warn(
						`[useGrouping] initialGroupBy contains an invalid group level.`,
						invalidLevel,
					);
					throw new Error(
						`[useGrouping] initialGroupBy contains an invalid group level.`,
					);
				}

				return [];
			}

			warnIfDuplicateCustomIds(initialLevels);
			return initialLevels;
		},
	);

	// Frozen at mount, seeded from the already-validated state above (same
	// fix pattern as usePagination's initialPageSizeRef/initialPageIndexRef)
	// -- so resetGrouping() always returns to a valid value, never a
	// possibly-invalid raw constructor argument.
	const initialLevelsRef = useRef(activeGroupBy);

	const deferredGroupBy = useDeferredValue(activeGroupBy);
	const groupByForCompute = options?.defer ? deferredGroupBy : activeGroupBy;

	const groupedArray = useMemo(
		() =>
			computeGroupedArray(
				items,
				groupByForCompute,
				unknownGroupKey,
				ungroupedGroupKey,
			),
		[items, groupByForCompute, unknownGroupKey, ungroupedGroupKey],
	);

	const topLevelGroupsByKey = useMemo(() => {
		const map = new Map<string, Group<T>>();

		for (const group of groupedArray) {
			if (!map.has(group.key)) map.set(group.key, group);
		}

		return map;
	}, [groupedArray]);

	const groupedRecord = useMemo(() => {
		const record: Record<string, T[]> = {};

		for (const group of groupedArray) {
			record[group.key] = group.items;
		}

		return record;
	}, [groupedArray]);

	const groupKeys = useMemo(() => groupedArray.map((g) => g.key), [groupedArray]);

	const totalGroups = groupKeys.length;
	const hasActiveGrouping = activeGroupBy.length > 0;

	const changeGroupBy = useCallback(
		(newGroupBy: GroupByLevel<T> | GroupByLevel<T>[]) => {
			const normalized = normalizeGroupByInput(newGroupBy);
			const invalidLevel = normalized.find(
				(level) => !isLevelShapeValid(level),
			);

			if (invalidLevel) {
				if (isDev) {
					console.warn(
						`[useGrouping] changeGroupBy: received an invalid group level.`,
						invalidLevel,
					);
					throw new Error(
						`[useGrouping] changeGroupBy: received an invalid group level.`,
					);
				}

				return;
			}

			warnIfDuplicateCustomIds(normalized);
			setActiveGroupBy(normalized);
		},
		[],
	);

	const clearGrouping = useCallback(() => {
		setActiveGroupBy([]);
	}, []);

	const resetGrouping = useCallback(() => {
		setActiveGroupBy(initialLevelsRef.current);
	}, []);

	const getGroup = useCallback(
		(groupKey: string) => topLevelGroupsByKey.get(groupKey),
		[topLevelGroupsByKey],
	);

	const getGroupItems = useCallback(
		(groupKey: string) => topLevelGroupsByKey.get(groupKey)?.items ?? [],
		[topLevelGroupsByKey],
	);

	return {
		groupedArray,
		groupedRecord,
		groupKeys,
		totalGroups,
		activeGroupBy,
		hasActiveGrouping,
		unknownGroupKey,
		ungroupedGroupKey,
		changeGroupBy,
		clearGrouping,
		resetGrouping,
		getGroup,
		getGroupItems,
	};
}

export { type UseGroupingReturn, useGrouping };
