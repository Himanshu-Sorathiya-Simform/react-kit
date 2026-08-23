import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { getValue } from "../../shared/stateShared/utils.ts";
import { createSortComparator } from "./comparators.ts";
import type {
	SortConfig,
	SortConfigUpdate,
	SortOptionsForType,
	SortState,
	SortType,
	UseSortOptions,
} from "./types.ts";
import {
	applySortUpdate,
	isSortConfigShapeValid,
	warnIfDuplicateIds,
} from "./validation.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/** Return value of {@link useSort}. */
interface UseSortReturn<T> {
	/** `data`, sorted by every entry in `sorts`, applied in priority order. Same reference as `data` (no copy, no sort) when `sorts` is empty. */
	sortedItems: T[];

	/** The currently-active sort keys, in priority order. */
	sorts: SortState;

	/** `sorts.length`. */
	sortCount: number;

	/** `sortCount > 0`. */
	hasSorts: boolean;

	/** Adds a new sort key, or replaces the existing one with the same `id`. */
	upsertSorts: (sort: SortConfig) => void;

	/** Removes one sort key by `id`, or several at once by passing an array of ids. */
	removeSort: (id: string | string[]) => void;

	/** Clears every sort key - equivalent to `replaceSorts([])`. */
	clearSorts: () => void;

	/** Restores `sorts` to the value passed as `initialSorts` at mount. Later changes to that argument have no effect - the reset target is frozen at mount. */
	resetSorts: () => void;

	/** Replaces the entire `sorts` array at once. */
	replaceSorts: (sorts: SortState) => void;

	/**
	 * Cycles a sort key through asc -> desc -> (reset to asc, or remove
	 * entirely) - the standard three-state table-header sort interaction.
	 *
	 * @remarks
	 * - Whether the last step resets to asc or removes the sort key
	 *   entirely depends on `disableSortRemoval` (checked on both the
	 *   existing config and the newly-passed `options`).
	 * - `options.multi` (`false` by default) controls whether toggling
	 *   this key adds/updates it alongside any other active sort keys
	 *   (`true`), or replaces the entire `sorts` array with just this one
	 *   key (`false`) - the usual "click a column to sort by only that
	 *   column, shift-click to add a secondary sort" pattern.
	 * - `type` must be supplied on every call, even for an already-active
	 *   sort key - this hook has no independent memory of a key's type
	 *   beyond what's in `sorts` itself.
	 */
	toggleSort: <TType extends SortType>(
		id: string,
		type: TType,
		options?: SortOptionsForType<TType> & { multi?: boolean; field?: string },
	) => void;

	/**
	 * Partially updates an existing sort key's config by `id`.
	 * @remarks An unknown `id`, or an update that would produce a
	 * structurally invalid config for its `type`, is rejected - see
	 * {@link isSortConfigShapeValid}.
	 */
	updateSortConfig: (id: string, partialConfig: SortConfigUpdate) => void;

	/** Looks up a sort key's full config by `id`. `undefined` if no such key exists. */
	getSort: (id: string) => SortConfig | undefined;

	/** `"asc"`/`"desc"` for an active sort key, `undefined` if `id` isn't currently sorted. */
	getSortDirection: (id: string) => "asc" | "desc" | undefined;

	/** What `toggleSort(id, ...)` would transition `id` to next, without actually calling it - useful for rendering the right sort-direction icon before the user clicks. */
	getNextSortingOrder: (id: string) => "asc" | "desc" | "none";

	/** This sort key's 1-based priority among active sort keys (`1` = primary), or `undefined` if `id` isn't currently sorted. */
	getSortIndex: (id: string) => number | undefined;
}

/**
 * Sorts an array by one or more keys - single-column or multi-column,
 * priority determined by array order.
 *
 * @remarks
 * - **Multi-key sort**: `sorts[0]` is the primary sort; later entries in
 *   the array only break ties left unresolved by earlier ones - the same
 *   convention as `Array.prototype.sort` with a compound comparator, or a
 *   spreadsheet's "sort by, then by" dialog.
 * - **Validation is dev/prod-split**, uniformly across every mutator that
 *   can produce a structurally invalid config (`toggleSort`,
 *   `updateSortConfig`), and across an unresolvable sort key encountered
 *   during sorting itself (unknown `type`, or a `custom` sort missing its
 *   `compare` function): throws immediately in development, but degrades
 *   gracefully in production (an invalid mutation is rejected/no-op; an
 *   unresolvable sort key at compute time is simply skipped, later keys
 *   still apply).
 * - **`sortUndefined`'s `"first"`/`"last"` are absolute positions**, never
 *   affected by `desc`/`invertSorting`; `-1`/`1` simulate a real extreme
 *   value and do flip with direction - see {@link SortUndefinedOption}.
 * - **`resetSorts` is frozen at mount** - it restores `initialSorts` as it
 *   was on the very first render, not whatever value that argument holds
 *   on a later render.
 * - **Id lookups are O(1)**, backed by a `Map` built once per `sorts`
 *   change, not a linear scan per call - safe to call `getSort`/
 *   `getSortDirection`/etc. once per rendered column header without a
 *   performance concern.
 *
 * @typeParam T - The type of each item in `data`.
 * @param data - The items to sort. Defaults to `[]`.
 * @param initialSorts - Sort keys applied at mount. Defaults to `[]` (no sorting).
 * @param options - See {@link UseSortOptions}.
 * @returns The sorted items and the current sort state, plus the actions
 * to change it. See {@link UseSortReturn}.
 *
 * @example
 * Single column, via a table header click handler:
 * ```tsx
 * const { sortedItems, getSortDirection, toggleSort } = useSort(rows);
 *
 * <th onClick={() => toggleSort("name", "alphabetical")}>
 *   Name {getSortDirection("name") === "asc" ? "▲" : "▼"}
 * </th>
 * ```
 *
 * @example
 * Multi-key, set directly:
 * ```tsx
 * const { sortedItems, replaceSorts } = useSort(orders, [
 *   { id: "status", type: "alphabetical" },
 *   { id: "placedAt", type: "date", desc: true },
 * ]);
 * // sorted by status first; same-status orders sorted by placedAt, newest first
 * ```
 */
function useSort<T>(
	data: T[] = [],
	initialSorts: SortState = [],
	options?: UseSortOptions,
): UseSortReturn<T> {
	const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
	const safeInitialSorts = useMemo(
		() => (Array.isArray(initialSorts) ? initialSorts : []),
		[initialSorts],
	);

	const initialSortsRef = useRef(safeInitialSorts);

	const [sorts, setSorts] = useState(() => {
		warnIfDuplicateIds(safeInitialSorts, "initialSorts");

		return safeInitialSorts;
	});

	const deferredSorts = useDeferredValue(sorts);
	const sortsForCompute = options?.defer ? deferredSorts : sorts;

	const sortedItems = useMemo(() => {
		if (sortsForCompute.length === 0) return safeData;

		type ResolvedSort = {
			pathArray: string[];
			compareValues: (valueA: unknown, valueB: unknown) => number;
		};

		const processedSorts: ResolvedSort[] = [];

		for (const sortConfig of sortsForCompute) {
			const {
				id,
				type,
				field,
				desc = false,
				invertSorting = false,
			} = sortConfig;
			const pathArray = (field ?? id).split(".");
			const effectiveDesc = desc !== invertSorting;

			const compareValues = createSortComparator(sortConfig, effectiveDesc);

			if (!compareValues) {
				if (isDev) {
					console.warn(
						`[useSort] sort "${id}" could not be resolved (type "${type}" is unknown, or a "custom" sort is missing its "compare" function). Skipping this sort key.`,
					);

					throw new Error(
						`[useSort] sort "${id}" could not be resolved (type "${type}" is unknown, or a "custom" sort is missing its "compare" function).`,
					);
				}

				continue;
			}

			processedSorts.push({ pathArray, compareValues });
		}

		if (processedSorts.length === 0) return safeData;

		return [...safeData].sort((itemA, itemB) => {
			for (const { pathArray, compareValues } of processedSorts) {
				const valueA = getValue(itemA, pathArray);
				const valueB = getValue(itemB, pathArray);
				const result = compareValues(valueA, valueB);

				if (result !== 0) return result;
			}

			return 0;
		});
	}, [safeData, sortsForCompute]);

	const sortCount = sorts.length;
	const hasSorts = sortCount > 0;

	const upsertSorts = useCallback((sort: SortConfig) => {
		setSorts((prev) => {
			const exists = prev.some((s) => s.id === sort.id);

			if (exists) {
				return prev.map((s) => (s.id === sort.id ? sort : s));
			}

			return [...prev, sort];
		});
	}, []);

	const removeSort = useCallback((id: string | string[]) => {
		setSorts((prev) => {
			if (Array.isArray(id)) {
				return prev.filter((s) => !id.includes(s.id));
			}

			return prev.filter((s) => s.id !== id);
		});
	}, []);

	const clearSorts = useCallback(() => setSorts([]), []);

	const resetSorts = useCallback(() => setSorts(initialSortsRef.current), []);

	const replaceSorts = useCallback((newSorts: SortState) => {
		const safeSorts = Array.isArray(newSorts) ? newSorts : [];

		warnIfDuplicateIds(safeSorts, "replaceSorts");

		setSorts(safeSorts);
	}, []);

	const toggleSort = useCallback(
		<TType extends SortType>(
			id: string,
			type: TType,
			options?: SortOptionsForType<TType> & {
				multi?: boolean;
				field?: string;
			},
		) => {
			const safeOptions: Partial<
				SortOptionsForType<TType> & { multi?: boolean; field?: string }
			> = options ?? {};
			const { multi = false, ...sortOptions } = safeOptions;

			setSorts((prev) => {
				const existingSort = prev.find((s) => s.id === id);

				if (!existingSort) {
					const newSort = {
						id,
						type,
						...sortOptions,
						desc: false,
					} as SortConfig;

					if (!isSortConfigShapeValid(newSort)) {
						if (isDev) {
							console.warn(
								`[useSort] toggleSort: constructed an invalid sort config for id "${id}" (type "${type}").`,
							);

							throw new Error(
								`[useSort] toggleSort: constructed an invalid sort config for id "${id}" (type "${type}").`,
							);
						}

						return prev;
					}

					return multi ? [...prev, newSort] : [newSort];
				}

				if (!existingSort.desc) {
					const updatedSort = {
						...existingSort,
						...sortOptions,
						desc: true,
					} as SortConfig;

					if (!isSortConfigShapeValid(updatedSort)) {
						if (isDev) {
							console.warn(
								`[useSort] toggleSort: update would produce an invalid sort config for id "${id}".`,
							);

							throw new Error(
								`[useSort] toggleSort: update would produce an invalid sort config for id "${id}".`,
							);
						}

						return prev;
					}

					return multi ?
							prev.map((s) => (s.id === id ? updatedSort : s))
						:	[updatedSort];
				}

				if (
					existingSort.disableSortRemoval
					|| sortOptions.disableSortRemoval
				) {
					const resetSort = {
						...existingSort,
						...sortOptions,
						desc: false,
					} as SortConfig;

					if (!isSortConfigShapeValid(resetSort)) {
						if (isDev) {
							console.warn(
								`[useSort] toggleSort: update would produce an invalid sort config for id "${id}".`,
							);

							throw new Error(
								`[useSort] toggleSort: update would produce an invalid sort config for id "${id}".`,
							);
						}

						return prev;
					}

					return multi ?
							prev.map((s) => (s.id === id ? resetSort : s))
						:	[resetSort];
				}

				return multi ? prev.filter((s) => s.id !== id) : [];
			});
		},
		[],
	);

	const updateSortConfig = useCallback(
		(id: string, partialConfig: SortConfigUpdate) => {
			setSorts((prev) =>
				applySortUpdate(prev, id, partialConfig, "updateSortConfig"),
			);
		},
		[],
	);

	const sortsById = useMemo(() => {
		const map = new Map<string, SortConfig>();

		for (const s of sorts) {
			if (!map.has(s.id)) map.set(s.id, s);
		}

		return map;
	}, [sorts]);

	const sortIndexById = useMemo(() => {
		const map = new Map<string, number>();

		sorts.forEach((s, index) => {
			if (!map.has(s.id)) map.set(s.id, index);
		});

		return map;
	}, [sorts]);

	const getSort = useCallback((id: string) => sortsById.get(id), [sortsById]);

	const getSortDirection = useCallback(
		(id: string) => {
			const sort = sortsById.get(id);

			return (
				!sort ? undefined
				: sort.desc ? "desc"
				: "asc"
			);
		},
		[sortsById],
	);

	const getNextSortingOrder = useCallback(
		(id: string) => {
			const sort = sortsById.get(id);

			if (!sort) return "asc";
			if (!sort.desc) return "desc";

			return sort.disableSortRemoval ? "asc" : "none";
		},
		[sortsById],
	);

	const getSortIndex = useCallback(
		(id: string) => {
			const index = sortIndexById.get(id);

			return index === undefined ? undefined : index + 1;
		},
		[sortIndexById],
	);

	return {
		sortedItems,
		sorts,
		sortCount,
		hasSorts,
		upsertSorts,
		removeSort,
		clearSorts,
		resetSorts,
		replaceSorts,
		toggleSort,
		updateSortConfig,
		getSort,
		getSortDirection,
		getNextSortingOrder,
		getSortIndex,
	};
}

export { type UseSortReturn, useSort };
