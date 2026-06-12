import { useCallback, useMemo, useState } from "react";
import { FILTER_STRATEGIES } from "../utils/filterUtils.ts";
import { getValue } from "../utils/utils.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

type FilterType =
	| "text"
	| "number"
	| "boolean"
	| "date"
	| "select"
	| "multiselect"
	| "custom";

type TextOperator =
	| "contains"
	| "equals"
	| "startsWith"
	| "endsWith"
	| "notContains";
type NumberOperator =
	| "equals"
	| "greaterThan"
	| "lessThan"
	| "greaterThanOrEqual"
	| "lessThanOrEqual"
	| "between";
type BooleanOperator = "equals";
type DateOperator = "equals" | "before" | "after" | "between";
type SelectOperator = "equals" | "notEquals";
type MultiselectOperator = "in" | "notIn" | "intersects";
type CustomOperator = "custom";

type FilterOperator =
	| TextOperator
	| NumberOperator
	| BooleanOperator
	| DateOperator
	| SelectOperator
	| MultiselectOperator
	| CustomOperator;

interface FilterOptions {
	caseSensitive?: boolean;
	compare?: (itemValue: any, filterValue: any, item: any) => boolean;
}

interface FilterConfig extends FilterOptions {
	id: string;
	field: string;
	type: FilterType;
	operator: FilterOperator;
	value: any;
}

type FilterState = FilterConfig[];

interface UseFilterReturn<T> {
	filteredItems: T[];
	filters: FilterState;
	addFilter: (filter: FilterConfig) => void;
	removeFilter: (id: string | string[]) => void;
	clearFilters: () => void;
	resetFilters: () => void;
	setFilters: (filters: FilterConfig[]) => void;
	toggleFilter: (filter: FilterConfig) => void;
	updateFilterConfig: (
		id: string,
		partialConfig: Partial<Omit<FilterConfig, "id">>,
	) => void;
	getFilterValue: (id: string) => any;
	updateFilterValue: (id: string, value: any) => void;
	isFilterActive: (id: string) => boolean;
}

function useFilter<T>(
	data: T[],
	initialFilters: FilterState = [],
): UseFilterReturn<T> {
	const [filters, setFilters] = useState<FilterState>(initialFilters);

	const filteredItems = useMemo(
		() =>
			data.filter((item) => {
				return filters.every((filterConfig) => {
					const { id, field, type, operator, value, compare } =
						filterConfig;
					const itemValue = getValue(item, field, id);

					if (type === "custom" || operator === "custom") {
						return compare ? compare(itemValue, value, item) : true;
					}

					const strategyBlock = FILTER_STRATEGIES[type];

					if (!strategyBlock) return true;

					const operatorFn = strategyBlock[operator];

					if (!operatorFn) return true;

					return operatorFn(itemValue, value, filterConfig);
				});
			}),
		[data, filters],
	);

	const addFilter = useCallback((filter: FilterConfig) => {
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

	const changeFilters = useCallback((filters: FilterConfig[]) => {
		setFilters(filters);
	}, []);

	const getFilterValue = useCallback(
		(id: string) => {
			const filter = filters.find((f) => f.id === id);

			return filter?.value;
		},
		[filters],
	);

	const updateFilterValue = useCallback((id: string, value: any) => {
		setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, value } : f)));
	}, []);

	const isFilterActive = useCallback(
		(id: string) => {
			return filters.some((f) => f.id === id);
		},
		[filters],
	);

	const toggleFilter = useCallback((filter: FilterConfig) => {
		setFilters((prev) => {
			const exists = prev.some((f) => f.id === filter.id);

			if (exists) {
				return prev.filter((f) => f.id !== filter.id);
			}

			return [...prev, filter];
		});
	}, []);

	const updateFilterConfig = useCallback(
		(id: string, partialConfig: Partial<Omit<FilterConfig, "id">>) => {
			setFilters((prev) =>
				prev.map((f) => (f.id === id ? { ...f, ...partialConfig } : f)),
			);
		},
		[],
	);

	return {
		filteredItems,
		filters,
		addFilter,
		removeFilter,
		clearFilters,
		resetFilters,
		toggleFilter,
		updateFilterConfig,
		setFilters: changeFilters,
		getFilterValue,
		updateFilterValue,
		isFilterActive,
	};
}

export {
	type BooleanOperator,
	type CustomOperator,
	type DateOperator,
	type FilterConfig,
	type FilterOperator,
	type FilterOptions,
	type FilterState,
	type FilterType,
	type MultiselectOperator,
	type NumberOperator,
	type SelectOperator,
	type TextOperator,
	type UseFilterReturn,
	useFilter,
};
