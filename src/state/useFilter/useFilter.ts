import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { getValue } from "../../shared/stateShared/utils.ts";
import { getStrategyFn } from "./strategies.ts";
import type {
	FilterConfig,
	FilterConfigUpdate,
	FilterState,
	UseFilterOptions,
} from "./types.ts";
import { applyFilterUpdate, warnIfDuplicateIds } from "./validation.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/** Return value of {@link useFilter}. */
interface UseFilterReturn<T> {
	/** `data`, filtered by every active entry in `filters` (AND-combined). Same reference as `data` (no copy, no filter) when there are no active filters. */
	filteredItems: T[];

	/** Every configured filter, active or not. */
	filters: FilterState<T>;

	/** Count of filters with `isActive !== false`. */
	activeFilterCount: number;

	/** `activeFilterCount > 0`. */
	hasActiveFilters: boolean;

	/** Adds a new filter, or replaces the existing one with the same `id`. */
	upsertFilter: (filter: FilterConfig<T>) => void;

	/** Removes one filter by `id`, or several at once by passing an array of ids. */
	removeFilter: (id: string | string[]) => void;

	/** Clears every filter entirely - equivalent to `replaceFilters([])`. */
	clearFilters: () => void;

	/** Restores `filters` to the value passed as `initialFilters` at mount. Later changes to that argument have no effect - the reset target is frozen at mount. */
	resetFilters: () => void;

	/** Replaces the entire `filters` array at once. */
	replaceFilters: (filters: FilterConfig<T>[]) => void;

	/** Flips a filter's `isActive` (defaulting to `true` if the filter doesn't exist yet, in which case it's added). Configuration (operator, value, etc.) is preserved either way. */
	toggleFilter: (filter: FilterConfig<T>) => void;

	/**
	 * Partially updates an existing filter's config by `id`.
	 * @remarks An unknown `id`, or an update that would produce a value
	 * incompatible with the filter's `type`/`operator`, is rejected - see
	 * {@link isValueShapeValid}.
	 */
	updateFilterConfig: (id: string, partialConfig: FilterConfigUpdate<T>) => void;

	/** Looks up a filter's full config by `id`. `undefined` if no such filter exists. */
	getFilter: (id: string) => FilterConfig<T> | undefined;

	/** Just a filter's `value`, by `id`. `undefined` if no such filter exists. */
	getFilterValue: (id: string) => unknown;

	/** Sugar for `updateFilterConfig(id, { value })` - updates only a filter's value, leaving its type/operator/other options untouched. */
	updateFilterValue: (id: string, value: unknown) => void;

	/** Whether a filter (by `id`) currently participates in filtering. `false` for a nonexistent `id`, same as an explicitly inactive one. */
	isFilterActive: (id: string) => boolean;
}

/**
 * Filters an array against one or more configured conditions - text
 * matching, numeric/date comparisons and ranges, boolean/select/multiselect
 * matching, or a fully custom predicate.
 *
 * @remarks
 * - **Every active filter is AND-combined** - an item must satisfy all of
 *   them to be included. There's no built-in OR-across-filters; use a
 *   `custom` filter for that if needed.
 * - **Missing/incomparable data always excludes the item**, uniformly
 *   across every built-in operator - including the "negative" ones like
 *   `notContains`/`notEquals`/`notIn`. A row with no value for the field is
 *   treated as "unknown," never as a confident non-match. See
 *   `FILTER_STRATEGIES`'s file-level `@remarks` for the full reasoning.
 * - **Validation is dev/prod-split**, same convention as this library's
 *   other hooks: an unknown `type`/`operator` combination, or a `custom`
 *   filter missing its `compare` function, throws immediately in
 *   development, but is silently excluded (that filter matches nothing) in
 *   production.
 * - **`field` falls back to `id`** when omitted - so a filter whose `id`
 *   already matches the data's field name doesn't need `field` set
 *   separately.
 * - **Id lookups are O(1)**, backed by a `Map` built once per `filters`
 *   change, not a linear scan per call.
 *
 * @typeParam T - The type of each item in `data`.
 * @param data - The items to filter. Defaults to `[]`.
 * @param initialFilters - Filters applied at mount. Defaults to `[]` (no filtering).
 * @param options - See {@link UseFilterOptions}.
 * @returns The filtered items and the current filter state, plus the
 * actions to change it. See {@link UseFilterReturn}.
 *
 * @example
 * ```tsx
 * const { filteredItems, upsertFilter } = useFilter(products, [
 *   { id: "category", type: "select", operator: "equals", value: "Books" },
 * ]);
 *
 * upsertFilter({
 *   id: "price",
 *   type: "number",
 *   operator: "between",
 *   value: { min: 10, max: 50 },
 * });
 * ```
 */
function useFilter<T>(
	data: T[] = [],
	initialFilters: FilterState<T> = [],
	options?: UseFilterOptions,
): UseFilterReturn<T> {
	const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
	const safeInitialFilters = useMemo(
		() => (Array.isArray(initialFilters) ? initialFilters : []),
		[initialFilters],
	);

	const initialFiltersRef = useRef(safeInitialFilters);

	const [filters, setFilters] = useState(() => {
		warnIfDuplicateIds(safeInitialFilters, "initialFilters");

		return safeInitialFilters;
	});

	const deferredFilters = useDeferredValue(filters);
	const filtersForCompute = options?.defer ? deferredFilters : filters;

	const filteredItems = useMemo(() => {
		type ResolvedFilter = {
			pathArray: string[];
			evaluate: (itemValue: unknown, item: T) => boolean;
		};

		const processedFilters: ResolvedFilter[] = filtersForCompute
			.filter((f) => f.isActive !== false)
			.map((filterConfig): ResolvedFilter => {
				const { id, type, operator, value, compare, field } = filterConfig;
				const pathArray = (field ?? id).split(".");

				if (type === "custom") {
					if (!compare) {
						if (isDev) {
							console.warn(
								`[useFilter] filter "${id}" has type "custom" but no "compare" function was provided. Excluding all items for this filter.`,
							);
						}

						return { pathArray, evaluate: () => false };
					}

					return {
						pathArray,
						evaluate: (itemValue, item) =>
							compare(itemValue, value, item),
					};
				}

				const strategyFn = getStrategyFn(type, operator);

				if (!strategyFn) {
					if (isDev) {
						console.warn(
							`[useFilter] filter "${id}" has an unknown type/operator combination ("${type}"/"${operator}"). Excluding all items for this filter.`,
						);
					}

					return { pathArray, evaluate: () => false };
				}

				return {
					pathArray,
					evaluate: (itemValue) =>
						strategyFn(itemValue, value, filterConfig),
				};
			});

		if (processedFilters.length === 0) return safeData;

		return safeData.filter((item) =>
			processedFilters.every(({ pathArray, evaluate }) =>
				evaluate(getValue(item, pathArray), item),
			),
		);
	}, [safeData, filtersForCompute]);

	const activeFilterCount = useMemo(
		() => filters.filter((f) => f.isActive !== false).length,
		[filters],
	);

	const hasActiveFilters = activeFilterCount > 0;

	const upsertFilter = useCallback((filter: FilterConfig<T>) => {
		setFilters((prev) => {
			const exists = prev.some((f) => f.id === filter.id);

			if (exists) {
				return prev.map((f) => (f.id === filter.id ? filter : f));
			}

			return [...prev, filter];
		});
	}, []);

	const removeFilter = useCallback((id: string | string[]) => {
		setFilters((prev) => {
			if (Array.isArray(id)) {
				return prev.filter((f) => !id.includes(f.id));
			}

			return prev.filter((f) => f.id !== id);
		});
	}, []);

	const clearFilters = useCallback(() => {
		setFilters([]);
	}, []);

	const resetFilters = useCallback(() => {
		setFilters(initialFiltersRef.current);
	}, []);

	const replaceFilters = useCallback((newFilters: FilterConfig<T>[]) => {
		const safeFilters = Array.isArray(newFilters) ? newFilters : [];

		warnIfDuplicateIds(safeFilters, "replaceFilters");

		setFilters(safeFilters);
	}, []);

	const toggleFilter = useCallback((filter: FilterConfig<T>) => {
		setFilters((prev) => {
			const index = prev.findIndex((f) => f.id === filter.id);
			const target = prev[index];

			if (index === -1 || !target) {
				return [...prev, { ...filter, isActive: true }];
			}

			const next = [...prev];
			next[index] = {
				...target,
				isActive: target.isActive !== false ? false : true,
			};
			return next;
		});
	}, []);

	const updateFilterConfig = useCallback(
		(id: string, partialConfig: FilterConfigUpdate<T>) => {
			setFilters((prev) =>
				applyFilterUpdate(prev, id, partialConfig, "updateFilterConfig"),
			);
		},
		[],
	);

	const updateFilterValue = useCallback((id: string, value: unknown) => {
		setFilters((prev) =>
			applyFilterUpdate(
				prev,
				id,
				{ value } as FilterConfigUpdate<T>,
				"updateFilterValue",
			),
		);
	}, []);

	const filtersById = useMemo(() => {
		const map = new Map<string, FilterConfig<T>>();

		for (const f of filters) {
			if (!map.has(f.id)) map.set(f.id, f);
		}

		return map;
	}, [filters]);

	const getFilter = useCallback(
		(id: string) => filtersById.get(id),
		[filtersById],
	);

	const getFilterValue = useCallback(
		(id: string) => filtersById.get(id)?.value,
		[filtersById],
	);

	const isFilterActive = useCallback(
		(id: string) => {
			const filter = filtersById.get(id);
			return filter ? filter.isActive !== false : false;
		},
		[filtersById],
	);

	return {
		filteredItems,
		filters,
		activeFilterCount,
		hasActiveFilters,
		upsertFilter,
		removeFilter,
		clearFilters,
		resetFilters,
		replaceFilters,
		toggleFilter,
		updateFilterConfig,
		getFilter,
		getFilterValue,
		updateFilterValue,
		isFilterActive,
	};
}

export { type UseFilterReturn, useFilter };
