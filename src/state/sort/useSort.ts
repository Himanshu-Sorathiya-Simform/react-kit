import { useCallback, useMemo, useRef, useState } from "react";
import { getValue } from "../../shared/utils.ts";
import type {
	SortConfig,
	SortOptionsForType,
	SortState,
	SortType,
} from "./types.ts";
import {
	compareAlphabetical,
	compareAlphanumeric,
	compareBasic,
	compareBooleans,
	compareCustom,
	compareDates,
	compareNumbers,
} from "./utils.ts";

interface UseSortReturn<T> {
	sortedItems: T[];
	sorts: SortState;
	upsertSorts: (sort: SortConfig) => void;
	removeSort: (id: string | string[]) => void;
	clearSorts: () => void;
	resetSorts: () => void;
	replaceSorts: (sorts: SortState) => void;
	toggleSort: <TType extends SortType>(
		id: string,
		type: TType,
		options?: SortOptionsForType<TType> & { multi?: boolean; field?: string },
	) => void;
	getSortDirection: (id: string) => "asc" | "desc" | undefined;
	getNextSortingOrder: (id: string) => "asc" | "desc" | "none";
	getSortIndex: (id: string) => number | undefined;
}

function useSort<T>(data: T[], initialSorts: SortState = []): UseSortReturn<T> {
	const initialSortsRef = useRef(initialSorts);

	const [sorts, setSorts] = useState(() => initialSorts);

	const sortedItems = useMemo(() => {
		const processedSorts = sorts.map(
			(sortConfig): SortConfig & { pathArray: string[] } => ({
				...sortConfig,
				pathArray: (sortConfig.field || sortConfig.id).split("."),
			}),
		);

		return [...data].sort((itemA, itemB) => {
			for (const sortConfig of processedSorts) {
				const {
					type,
					id,
					desc = false,
					invertSorting = false,
					pathArray,
				} = sortConfig;

				const valueA = getValue(itemA, pathArray, id);
				const valueB = getValue(itemB, pathArray, id);

				let result: number;

				switch (type) {
					case "numeric":
						result = compareNumbers(
							valueA,
							valueB,
							sortConfig as unknown as SortOptionsForType<"numeric">,
						);
						break;

					case "alphabetical":
						result = compareAlphabetical(
							valueA,
							valueB,
							sortConfig as unknown as SortOptionsForType<"alphabetical">,
						);
						break;

					case "alphanumeric":
						result = compareAlphanumeric(
							valueA,
							valueB,
							sortConfig as unknown as SortOptionsForType<"alphanumeric">,
						);
						break;

					case "boolean":
						result = compareBooleans(
							valueA,
							valueB,
							sortConfig as unknown as SortOptionsForType<"boolean">,
						);
						break;

					case "date":
						result = compareDates(
							valueA,
							valueB,
							sortConfig as unknown as SortOptionsForType<"date">,
						);
						break;

					case "basic":
						result = compareBasic(
							valueA,
							valueB,
							sortConfig as unknown as SortOptionsForType<"basic">,
						);
						break;

					case "custom":
						result = compareCustom(
							valueA,
							valueB,
							sortConfig as unknown as SortOptionsForType<"custom">,
						);
						break;

					default:
						result = compareBasic(
							valueA,
							valueB,
							sortConfig as unknown as SortOptionsForType<"basic">,
						);
				}

				if (result !== 0) {
					const multiplier = desc !== invertSorting ? -1 : 1;

					return result * multiplier;
				}
			}

			return 0;
		});
	}, [sorts, data]);

	const upsertSorts = useCallback(
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

	const resetSorts = useCallback(() => setSorts(initialSortsRef.current), []);

	const replaceSorts = useCallback((sorts: SortState) => setSorts(sorts), []);

	const toggleSort = useCallback(
		<TType extends SortType>(
			id: string,
			type: TType,
			options?: SortOptionsForType<TType> & {
				multi?: boolean;
				field?: string;
			},
		) => {
			const { multi = false, ...sortOptions } =
				options || ({} as NonNullable<typeof options>);

			setSorts((prev) => {
				const existingSort = prev.find((s) => s.id === id);

				if (!existingSort) {
					const newSort = {
						id,
						type,
						...sortOptions,
						desc: false,
					} as SortConfig;

					return multi ? [...prev, newSort] : [newSort];
				}

				if (!existingSort.desc) {
					const updatedSort = {
						...existingSort,
						...sortOptions,
						desc: true,
					} as SortConfig;

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

					return multi ?
							prev.map((s) => (s.id === id ? resetSort : s))
						:	[resetSort];
				}

				return multi ? prev.filter((s) => s.id !== id) : [];
			});
		},
		[],
	);

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
		upsertSorts,
		removeSort,
		clearSorts,
		resetSorts,
		replaceSorts,
		getSortDirection,
		toggleSort,
		getNextSortingOrder,
		getSortIndex,
	};
}

export { type UseSortReturn, useSort };
