import { useCallback, useMemo, useState } from "react";

interface UsePaginationReturn<T> {
	currentItems: T[];
	pageSize: number;
	pageIndex: number;
	totalPages: number;
	canPrevious: boolean;
	canNext: boolean;
	nextPage: () => void;
	previousPage: () => void;
	firstPage: () => void;
	lastPage: () => void;
	setPageIndex: (newPageIndex: number) => void;
	setPageSize: (newPageSize: number) => void;
	resetPageIndex: () => void;
	resetPageSize: () => void;
}

function usePagination<T>(
	data: T[],
	initialPageSize: number,
	initialPageIndex = 0,
): UsePaginationReturn<T> {
	const [pageSize, setPageSize] = useState(initialPageSize);
	const [pageIndex, setPageIndex] = useState(initialPageIndex);

	const totalPages = Math.max(1, Math.ceil(data.length / Math.max(1, pageSize)));

	const targetPageIndex = Math.min(Math.max(0, pageIndex), totalPages - 1);
	if (pageIndex !== targetPageIndex) {
		setPageIndex(targetPageIndex);
	}

	const currentItems = useMemo(() => {
		if (typeof pageSize !== "number" || pageSize < 1) {
			return [];
		}

		return data.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
	}, [pageIndex, pageSize, data]);

	const canPrevious = pageIndex > 0;
	const canNext = pageIndex < totalPages - 1;

	const nextPage = useCallback(() => {
		setPageIndex((prev) => (prev < totalPages - 1 ? prev + 1 : prev));
	}, [totalPages]);

	const previousPage = useCallback(() => {
		setPageIndex((prev) => (prev > 0 ? prev - 1 : prev));
	}, []);

	const firstPage = useCallback(() => {
		setPageIndex(0);
	}, []);

	const lastPage = useCallback(() => {
		setPageIndex(totalPages - 1);
	}, [totalPages]);

	const changePageIndex = useCallback(
		(newPageIndex: number) => {
			if (
				typeof newPageIndex === "number"
				&& newPageIndex >= 0
				&& newPageIndex <= totalPages - 1
			)
				setPageIndex(newPageIndex);
		},
		[totalPages],
	);

	const changePageSize = useCallback(
		(newPageSize: number) => {
			if (typeof newPageSize === "number" && newPageSize > 0) {
				setPageSize(newPageSize);

				const newTotalPages = Math.max(
					1,
					Math.ceil(data.length / Math.max(1, newPageSize)),
				);
				setPageIndex((prev) =>
					Math.min(Math.max(0, prev), newTotalPages - 1),
				);
			}
		},
		[data.length],
	);

	const resetPageIndex = useCallback(() => {
		setPageIndex(Math.min(Math.max(0, initialPageIndex), totalPages - 1));
	}, [initialPageIndex, totalPages]);

	const resetPageSize = useCallback(() => {
		setPageSize(Math.max(1, initialPageSize));

		const newTotalPages = Math.max(
			1,
			Math.ceil(data.length / Math.max(1, initialPageSize)),
		);
		setPageIndex((prev) => Math.min(Math.max(0, prev), newTotalPages - 1));
	}, [initialPageSize, data.length]);

	return {
		currentItems,
		pageSize,
		pageIndex,
		totalPages,
		canPrevious,
		canNext,
		nextPage,
		previousPage,
		firstPage,
		lastPage,
		setPageIndex: changePageIndex,
		setPageSize: changePageSize,
		resetPageIndex,
		resetPageSize,
	};
}

export { type UsePaginationReturn, usePagination };
