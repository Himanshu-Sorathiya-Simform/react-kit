import { useCallback, useMemo, useState } from "react";
import {
	compareAlphabetical,
	compareAlphanumeric,
	compareBasic,
	compareBooleans,
	compareCustom,
	compareDates,
	compareNumbers,
} from "../utils/sortUtils.ts";
import { getValue } from "../utils/utils.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

type SortType =
	| "numeric"
	| "alphabetical"
	| "alphanumeric"
	| "boolean"
	| "date"
	| "basic"
	| "custom";

interface SortOptions {
	desc?: boolean;
	caseSensitive?: boolean;
	disableSortRemoval?: boolean;
	invertSorting?: boolean;
	sortUndefined?: "first" | "last" | false | -1 | 1;
	compare?: (a: any, b: any) => number;
}

interface SortConfig extends SortOptions {
	id: string;
	type: SortType;
	field?: string;
}

type SortState = Array<SortConfig>;

interface UseSortReturn<T> {
	sortedItems: T[];
	sorts: SortState;
	addSort: (sort: SortConfig) => void;
	removeSort: (id: string | string[]) => void;
	clearSorts: () => void;
	resetSorts: () => void;
	setSorts: (sorts: SortState) => void;
	getSortDirection: (id: string) => "asc" | "desc" | undefined;
	toggleSort: (
		id: string,
		type: SortType,
		options?: SortOptions & {
			multi?: boolean;
		},
	) => void;
	getNextSortingOrder: (id: string) => "asc" | "desc" | "none";
	getSortIndex: (id: string) => number | undefined;
}

function useSort<T>(data: T[], initialSorts: SortState = []): UseSortReturn<T> {
	const [sorts, setSorts] = useState<SortState>(initialSorts);

	const sortedItems = useMemo(
		() =>
			data.toSorted((itemA, itemB) => {
				for (const sortConfig of sorts) {
					const {
						type,
						field,
						id,
						desc = false,
						invertSorting = false,
					} = sortConfig;

					const valueA = getValue(itemA, field, id);
					const valueB = getValue(itemB, field, id);

					let result: number;

					switch (type) {
						case "numeric":
							result = compareNumbers(valueA, valueB, sortConfig);
							break;

						case "alphabetical":
							result = compareAlphabetical(valueA, valueB, sortConfig);
							break;

						case "alphanumeric":
							result = compareAlphanumeric(valueA, valueB, sortConfig);
							break;

						case "boolean":
							result = compareBooleans(valueA, valueB, sortConfig);
							break;

						case "date":
							result = compareDates(valueA, valueB, sortConfig);
							break;

						case "basic":
							result = compareBasic(valueA, valueB, sortConfig);
							break;

						case "custom":
							result = compareCustom(valueA, valueB, sortConfig);
							break;

						default:
							result = compareBasic(valueA, valueB, sortConfig);
					}

					if (result !== 0) {
						const multiplier = desc !== invertSorting ? -1 : 1;

						return result * multiplier;
					}
				}

				return 0;
			}),
		[sorts, data],
	);

	const addSort = useCallback(
		(sort: SortConfig) =>
			setSorts((prev) => {
				const exists = prev.some((s) => s.id === sort.id);

				if (exists) {
					return prev.map((s) => (s.id === sort.id ? sort : s));
				}

				return [...prev, sort];
			}),
		[],
	);

	const removeSort = useCallback((id: string | string[]) => {
		setSorts((prev) => {
			if (Array.isArray(id)) {
				return prev.filter((s) => !id.includes(s.id));
			}

			return prev.filter((s) => s.id !== id);
		});
	}, []);

	const clearSorts = useCallback(() => setSorts([]), []);

	const resetSorts = useCallback(() => setSorts(initialSorts), [initialSorts]);

	const changeSorts = useCallback((sorts: SortState) => setSorts(sorts), []);

	const getSortDirection = useCallback(
		(id: string) => {
			const sort = sorts.find((sort) => sort.id === id);

			return (
				!sort ? undefined
				: sort.desc ? "desc"
				: "asc"
			);
		},
		[sorts],
	);

	const toggleSort = useCallback(
		(
			id: string,
			type: SortType,
			options?: SortOptions & { multi?: boolean },
		) => {
			const { multi = false, ...sortOptions } = options || {};

			setSorts((prev) => {
				const existingSort = prev.find((s) => s.id === id);

				if (!existingSort) {
					const newSort: SortConfig = {
						id,
						type,
						...(sortOptions as Partial<SortConfig>),
						desc: false,
					};

					return multi ? [...prev, newSort] : [newSort];
				}

				if (!existingSort.desc) {
					const updatedSort: SortConfig = {
						...existingSort,
						...sortOptions,
						desc: true,
					};

					return multi ?
							prev.map((s) => (s.id === id ? updatedSort : s))
						:	[updatedSort];
				}

				if (
					existingSort.disableSortRemoval
					|| sortOptions.disableSortRemoval
				) {
					const resetSort: SortConfig = {
						...existingSort,
						...sortOptions,
						desc: false,
					};

					return multi ?
							prev.map((s) => (s.id === id ? resetSort : s))
						:	[resetSort];
				}

				return multi ? prev.filter((s) => s.id !== id) : [];
			});
		},
		[],
	);

	const getNextSortingOrder = useCallback(
		(id: string) => {
			const sort = sorts.find((s) => s.id === id);

			if (!sort) return "asc";

			if (!sort.desc) return "desc";

			return sort.disableSortRemoval ? "asc" : "none";
		},
		[sorts],
	);

	const getSortIndex = useCallback(
		(id: string) => {
			const index = sorts.findIndex((s) => s.id === id);

			return index === -1 ? undefined : index + 1;
		},
		[sorts],
	);

	return {
		sortedItems,
		sorts,
		addSort,
		removeSort,
		clearSorts,
		resetSorts,
		setSorts: changeSorts,
		getSortDirection,
		toggleSort,
		getNextSortingOrder,
		getSortIndex,
	};
}

export {
	type SortConfig,
	type SortOptions,
	type SortState,
	type SortType,
	type UseSortReturn,
	useSort,
};
