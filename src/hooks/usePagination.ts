import { useState } from "react";

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

	let currentItems: T[] = [];
	if (typeof pageSize === "number" && pageSize >= 1) {
		currentItems = data.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
	}

	const canPrevious = pageIndex > 0;
	const canNext = pageIndex < totalPages - 1;

	function nextPage() {
		setPageIndex((prev) => (prev < totalPages - 1 ? prev + 1 : prev));
	}

	function previousPage() {
		setPageIndex((prev) => (prev > 0 ? prev - 1 : prev));
	}

	function firstPage() {
		setPageIndex(0);
	}

	function lastPage() {
		setPageIndex(totalPages - 1);
	}

	function changePageIndex(newPageIndex: number) {
		if (
			typeof newPageIndex === "number"
			&& newPageIndex >= 0
			&& newPageIndex <= totalPages - 1
		) {
			setPageIndex(newPageIndex);
		}
	}

	function changePageSize(newPageSize: number) {
		if (typeof newPageSize === "number" && newPageSize > 0) {
			setPageSize(newPageSize);
			const newTotalPages = Math.max(
				1,
				Math.ceil(data.length / Math.max(1, newPageSize)),
			);
			setPageIndex((prev) => Math.min(Math.max(0, prev), newTotalPages - 1));
		}
	}

	function resetPageIndex() {
		setPageIndex(Math.min(Math.max(0, initialPageIndex), totalPages - 1));
	}

	function resetPageSize() {
		setPageSize(Math.max(1, initialPageSize));
		const newTotalPages = Math.max(
			1,
			Math.ceil(data.length / Math.max(1, initialPageSize)),
		);
		setPageIndex((prev) => Math.min(Math.max(0, prev), newTotalPages - 1));
	}

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
