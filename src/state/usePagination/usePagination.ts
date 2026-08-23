import { useCallback, useMemo, useRef, useState } from "react";

import { isPositiveInteger } from "../../shared/stateShared/coercion";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/** Return value of {@link usePagination}. */
interface UsePaginationReturn<T> {
	/** The items for the current page - a slice of `data`, `pageSize` items long (fewer on the last page if `totalCount` doesn't divide evenly). */
	pageItems: T[];

	/**
	 * Current page, 1-based.
	 * @remarks Always clamped into `[1, totalPages]` for display, even if
	 * the underlying position becomes momentarily out of range (e.g. `data`
	 * shrinks). The clamp is display-only - see the `currentPageIndex` note
	 * in the implementation for why the real position isn't lost.
	 */
	pageNumber: number;

	/** Items per page. */
	pageSize: number;

	/** `Math.max(1, Math.ceil(totalCount / pageSize))` - always at least `1`, even for an empty `data`. */
	totalPages: number;

	/** `data.length` (after the array-safety check) - the un-paginated item count. */
	totalCount: number;

	/** 1-based index of the first item on the current page, for a "Showing X-Y of Z" display. `0` when `totalCount` is `0`. */
	startIndex: number;

	/** 1-based index of the last item on the current page. `0` when `totalCount` is `0`. */
	endIndex: number;

	/** Whether {@link UsePaginationReturn.previousPage} would move anywhere. */
	canPreviousPage: boolean;

	/** Whether {@link UsePaginationReturn.nextPage} would move anywhere. */
	canNextPage: boolean;

	/** Moves to the next page, if any. No-op (not a warning) on the last page - this is routine UI usage, not caller error. */
	nextPage: () => void;

	/** Moves to the previous page, if any. No-op on the first page. */
	previousPage: () => void;

	/** Jumps to page `1`. */
	goToFirstPage: () => void;

	/** Jumps to the last page. */
	goToLastPage: () => void;

	/**
	 * Jumps to a specific page.
	 * @remarks A well-formed but out-of-range page (e.g. `999` on a
	 * 5-page list) is clamped to the nearest valid page, not rejected -
	 * only a malformed value (non-integer, `< 1`, `NaN`, etc.) is treated
	 * as caller error. See {@link isPositiveInteger}.
	 */
	goToPage: (newPageNumber: number) => void;

	/**
	 * Changes `pageSize`.
	 * @remarks `pageNumber` is left untouched here - it re-bounds itself
	 * automatically against the new `totalPages` on the next render.
	 */
	changePageSize: (newPageSize: number) => void;

	/** Restores `pageNumber` to the value passed as `initialPageNumber` at mount. Later changes to that argument have no effect - the reset target is frozen at mount, same as `pageSize`/full pagination reset below. */
	resetPageNumber: () => void;

	/** Restores `pageSize` to the value passed as `initialPageSize` at mount. */
	resetPageSize: () => void;

	/** Restores both `pageNumber` and `pageSize` to their mount-time initial values, in one update. */
	resetPagination: () => void;
}

/**
 * Paginates an array client-side - slices `data` into pages and exposes the
 * navigation state and actions to move between them.
 *
 * @remarks
 * - **Validation is dev/prod-split**: passing a malformed page number or
 *   page size (non-integer, `< 1`, `NaN`, etc.) to the constructor or any
 *   mutator throws immediately in development (surfacing the bug fast), but
 *   silently falls back to the last valid value in production, rather than
 *   crashing a real user's session over a caller mistake. See
 *   {@link isPositiveInteger}.
 * - **Out-of-range is different from malformed.** `goToPage(999)` on a
 *   5-page list isn't an error - it's clamped to the last page. Only
 *   structurally invalid input (see above) is treated as a mistake.
 * - **`pageNumber` is 1-based** in this public API; page count/index math
 *   is kept 0-based internally.
 * - **Reset targets are frozen at mount.** `resetPageNumber`/`resetPageSize`/
 *   `resetPagination` always restore the `initialPageNumber`/`initialPageSize`
 *   values as they were on the very first render - passing different values
 *   to `usePagination` on a later render does not change what reset
 *   restores to.
 * - **No manual/server-side pagination mode** - `data` is always assumed to
 *   be the complete, un-paginated dataset, sliced client-side.
 *
 * @typeParam T - The type of each item in `data`.
 * @param data - The full, un-paginated array. Defaults to `[]`.
 * @param initialPageSize - Items per page at mount.
 * @defaultValue initialPageSize `10`
 * @param initialPageNumber - Starting page (1-based) at mount.
 * @defaultValue initialPageNumber `1`
 * @returns The current page's items, position, and the actions to
 * navigate/resize/reset. See {@link UsePaginationReturn}.
 *
 * @example
 * ```tsx
 * const { pageItems, pageNumber, totalPages, nextPage, previousPage } =
 *   usePagination(rows, 20);
 *
 * return (
 *   <>
 *     {pageItems.map((row) => <Row key={row.id} {...row} />)}
 *     <button onClick={previousPage}>Prev</button>
 *     <span>{pageNumber} / {totalPages}</span>
 *     <button onClick={nextPage}>Next</button>
 *   </>
 * );
 * ```
 */
function usePagination<T>(
	data: T[] = [],
	initialPageSize: number = 10,
	initialPageNumber: number = 1,
): UsePaginationReturn<T> {
	const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);

	const [pageSize, setPageSize] = useState(() => {
		if (isPositiveInteger(initialPageSize)) return initialPageSize;

		if (isDev) {
			console.warn(
				`[usePagination] initialPageSize must be a positive integer, received: ${initialPageSize}. Falling back to 10.`,
			);
			throw new Error(
				`[usePagination] initialPageSize must be a positive integer, received: ${initialPageSize}.`,
			);
		}

		return 10;
	});

	const [pageIndex, setPageIndex] = useState(() => {
		if (isPositiveInteger(initialPageNumber)) return initialPageNumber - 1;

		if (isDev) {
			console.warn(
				`[usePagination] initialPageNumber must be a positive integer, received: ${initialPageNumber}. Falling back to 1.`,
			);
			throw new Error(
				`[usePagination] initialPageNumber must be a positive integer, received: ${initialPageNumber}.`,
			);
		}

		return 0;
	});

	// Frozen at mount, seeded from the already-sanitized state above -- so
	// reset* functions always return to a valid value (never raw, possibly
	// garbage, constructor input) and the validation above never runs twice.
	const initialPageSizeRef = useRef(pageSize);
	const initialPageIndexRef = useRef(pageIndex);

	const totalCount = safeData.length;

	// Math.max(1, pageSize) here is belt-and-suspenders at this point --
	// pageSize is already guaranteed valid by every entry point above and
	// below -- but harmless to leave as a second line of defense.
	const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));

	// Derived, never written back to state -- clamped purely for display.
	// The underlying `pageIndex` state is left untouched, so if `data`
	// shrinks temporarily and then grows back, the user's actual position
	// is preserved instead of permanently overwritten.
	const currentPageIndex = Math.min(Math.max(0, pageIndex), totalPages - 1);

	const pageItems = useMemo(() => {
		if (isPositiveInteger(pageSize)) {
			return safeData.slice(
				currentPageIndex * pageSize,
				(currentPageIndex + 1) * pageSize,
			);
		}

		// Should be unreachable -- every entry point below validates pageSize
		// before it lands in state. If this fires, it's a bug in the hook
		// itself, not bad caller input.
		if (isDev) {
			console.warn(
				`[usePagination] internal invariant violated: pageSize should always be a valid positive integer here, received: ${pageSize}.`,
			);
			throw new Error(
				`[usePagination] internal invariant violated: pageSize should always be a valid positive integer here, received: ${pageSize}.`,
			);
		}

		return [];
	}, [currentPageIndex, pageSize, safeData]);

	const canPreviousPage = currentPageIndex > 0;
	const canNextPage = currentPageIndex < totalPages - 1;

	const startIndex = totalCount === 0 ? 0 : currentPageIndex * pageSize + 1;
	const endIndex =
		totalCount === 0 ? 0 : (
			Math.min((currentPageIndex + 1) * pageSize, totalCount)
		);

	const nextPage = useCallback(() => {
		setPageIndex((prev) => {
			// Re-clamp against the current totalPages before stepping -- prev
			// may be stale if data/pageSize changed since the last click, and
			// stepping from a stale value can otherwise leave the button
			// appearing to do nothing.
			const clamped = Math.min(Math.max(0, prev), totalPages - 1);
			return clamped < totalPages - 1 ? clamped + 1 : clamped;
		});
	}, [totalPages]);

	const previousPage = useCallback(() => {
		setPageIndex((prev) => {
			const clamped = Math.min(Math.max(0, prev), totalPages - 1);
			return clamped > 0 ? clamped - 1 : clamped;
		});
	}, [totalPages]);

	const goToFirstPage = useCallback(() => {
		setPageIndex(0);
	}, []);

	const goToLastPage = useCallback(() => {
		setPageIndex(totalPages - 1);
	}, [totalPages]);

	const goToPage = useCallback(
		(newPageNumber: number) => {
			if (!isPositiveInteger(newPageNumber)) {
				if (isDev) {
					console.warn(
						`[usePagination] goToPage: newPageNumber must be a positive integer, received: ${newPageNumber}.`,
					);
					throw new Error(
						`[usePagination] goToPage: newPageNumber must be a positive integer, received: ${newPageNumber}.`,
					);
				}

				return;
			}

			// Well-formed but out of range (e.g. page 999 of a 5-page list) is
			// routine usage, not a caller mistake -- clamp instead of warning.
			setPageIndex(Math.min(newPageNumber - 1, totalPages - 1));
		},
		[totalPages],
	);

	const changePageSize = useCallback((newPageSize: number) => {
		if (!isPositiveInteger(newPageSize)) {
			if (isDev) {
				console.warn(
					`[usePagination] changePageSize: newPageSize must be a positive integer, received: ${newPageSize}.`,
				);
				throw new Error(
					`[usePagination] changePageSize: newPageSize must be a positive integer, received: ${newPageSize}.`,
				);
			}

			return;
		}

		setPageSize(newPageSize);
		// pageIndex is intentionally left untouched here -- the derived
		// currentPageIndex re-bounds it against the new totalPages on the
		// very next render, so there's nothing left to manually clamp.
	}, []);

	const resetPageNumber = useCallback(() => {
		setPageIndex(initialPageIndexRef.current);
	}, []);

	const resetPageSize = useCallback(() => {
		setPageSize(initialPageSizeRef.current);
	}, []);

	const resetPagination = useCallback(() => {
		setPageSize(initialPageSizeRef.current);
		setPageIndex(initialPageIndexRef.current);
	}, []);

	return {
		pageItems,
		pageNumber: currentPageIndex + 1,
		pageSize,
		totalPages,
		totalCount,
		startIndex,
		endIndex,
		canPreviousPage,
		canNextPage,
		nextPage,
		previousPage,
		goToFirstPage,
		goToLastPage,
		goToPage,
		changePageSize,
		resetPageNumber,
		resetPageSize,
		resetPagination,
	};
}

export { type UsePaginationReturn, usePagination };
