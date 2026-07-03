import { useCallback, useMemo, useState } from "react";
import type { FilterConfig, FilterState } from "../types/filter.types.ts";
import { FILTER_STRATEGIES } from "../utils/filterUtils.ts";
import { getValue } from "../utils/utils.ts";

interface UseFilterReturn<T> {
	filteredItems: T[];
	filters: FilterState<T>;
	upsertFilter: (filter: FilterConfig<T>) => void;
	removeFilter: (id: string | string[]) => void;
	clearFilters: () => void;
	resetFilters: () => void;
	replaceFilters: (filters: FilterConfig<T>[]) => void;
	toggleFilter: (filter: FilterConfig<T>) => void;
	updateFilterConfig: (
		id: string,
		partialConfig: Partial<Omit<FilterConfig<T>, "id">>,
	) => void;
	getFilterValue: (id: string) => unknown;
	updateFilterValue: (id: string, value: unknown) => void;
	isFilterActive: (id: string) => boolean;
}

function useFilter<T>(
	data: T[],
	initialFilters: FilterState<T> = [],
): UseFilterReturn<T> {
	const [filters, setFilters] = useState<FilterState<T>>(initialFilters);

	const filteredItems = useMemo(() => {
		const processedFilters = filters
			.filter((f) => f.isActive !== false)
			.map((filterConfig): FilterConfig<T> & { pathArray: string[] } => ({
				...filterConfig,
				pathArray: (filterConfig.field || filterConfig.id).split("."),
			}));

		return data.filter((item) => {
			return processedFilters.every((filterConfig) => {
				const { id, type, operator, value, compare, pathArray } =
					filterConfig;
				const itemValue = getValue(item, pathArray, id);

				if (type === "custom") {
					return compare ? compare(itemValue, value, item) : true;
				}

				const strategyBlock = FILTER_STRATEGIES[type];

				if (!strategyBlock) return true;

				const operatorFn = strategyBlock[operator];

				if (!operatorFn) return true;

				return operatorFn(itemValue, value, filterConfig);
			});
		});
	}, [data, filters]);

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
		setFilters(initialFilters);
	}, [initialFilters]);

	const replaceFilters = useCallback((filters: FilterConfig<T>[]) => {
		setFilters(filters);
	}, []);

	const toggleFilter = useCallback((filter: FilterConfig<T>) => {
		setFilters((prev) => {
			const exists = prev.some((f) => f.id === filter.id);

			if (exists) {
				return prev.map((f) =>
					f.id === filter.id ?
						{ ...f, isActive: f.isActive === false ? true : false }
					:	f,
				);
			}

			return [...prev, { ...filter, isActive: true }];
		});
	}, []);

	const updateFilterConfig = useCallback(
		(id: string, partialConfig: Partial<Omit<FilterConfig<T>, "id">>) => {
			setFilters((prev) =>
				prev.map((f) =>
					f.id === id ?
						({ ...f, ...partialConfig } as FilterConfig<T>)
					:	f,
				),
			);
		},
		[],
	);

	const getFilterValue = useCallback(
		(id: string) => {
			const filter = filters.find((f) => f.id === id);

			return filter?.value;
		},
		[filters],
	);

	const updateFilterValue = useCallback((id: string, value: unknown) => {
		setFilters((prev) =>
			prev.map((f) =>
				f.id === id ? ({ ...f, value } as FilterConfig<T>) : f,
			),
		);
	}, []);

	const isFilterActive = useCallback(
		(id: string) => {
			const filter = filters.find((f) => f.id === id);

			return filter ? filter.isActive !== false : false;
		},
		[filters],
	);

	return {
		filteredItems,
		filters,
		upsertFilter,
		removeFilter,
		clearFilters,
		resetFilters,
		toggleFilter,
		updateFilterConfig,
		replaceFilters,
		getFilterValue,
		updateFilterValue,
		isFilterActive,
	};
}

export { type UseFilterReturn, useFilter };
