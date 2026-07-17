import { useCallback, useMemo, useRef, useState } from "react";
import { getValue } from "../../shared/utils.ts";

type VisibilityId = number | string;

interface UseVisibilityReturn<T> {
	visibleIds: VisibilityId[];
	visibleItems: T[];
	hiddenItems: T[];
	visibleCount: number;
	isVisible: (itemOrId: VisibilityId | T) => boolean;
	show: (itemOrId: VisibilityId | T) => void;
	hide: (itemOrId: VisibilityId | T) => void;
	toggleVisibility: (itemOrId: VisibilityId | T) => void;
	showAll: (itemsArray?: VisibilityId[] | T[]) => void;
	hideAll: (itemsArray?: VisibilityId[] | T[]) => void;
	resetVisibility: () => void;
	replaceVisibility: (newVisibleItems: VisibilityId[] | T[]) => void;
}

function useVisibility<T = unknown>(
	options: {
		items?: T[];
		field?: string;
		initialVisibleIds?: VisibilityId[];
	} = {},
): UseVisibilityReturn<T> {
	const safeOptions = options || {};

	const items = useMemo(
		() => (Array.isArray(safeOptions.items) ? safeOptions.items : []),
		[safeOptions.items],
	);
	const initialVisibleIds =
		Array.isArray(safeOptions.initialVisibleIds) ?
			safeOptions.initialVisibleIds
		:	[];
	const field = safeOptions.field;

	const initialIdsRef = useRef(initialVisibleIds);

	const [visibleIds, setVisibleIds] = useState(() => new Set(initialVisibleIds));

	const isVisible = useCallback(
		(itemOrId: VisibilityId | T) => {
			const idToCheck = getValue(itemOrId, field);

			return visibleIds.has(idToCheck);
		},
		[visibleIds, field],
	);

	const show = useCallback(
		(itemOrId: VisibilityId | T) => {
			setVisibleIds((prev) => {
				const newSet = new Set(prev);
				const idToAdd = getValue(itemOrId, field);

				newSet.add(idToAdd);

				return newSet;
			});
		},
		[field],
	);

	const hide = useCallback(
		(itemOrId: VisibilityId | T) => {
			setVisibleIds((prev) => {
				const newSet = new Set(prev);
				const idToRemove = getValue(itemOrId, field);

				newSet.delete(idToRemove);

				return newSet;
			});
		},
		[field],
	);

	const toggleVisibility = useCallback(
		(itemOrId: VisibilityId | T) => {
			setVisibleIds((prev) => {
				const newSet = new Set(prev);
				const idToToggle = getValue(itemOrId, field);

				if (newSet.has(idToToggle)) newSet.delete(idToToggle);
				else newSet.add(idToToggle);

				return newSet;
			});
		},
		[field],
	);

	const showAll = useCallback(
		(itemsArray?: VisibilityId[] | T[]) => {
			setVisibleIds((prev) => {
				const newSet = new Set(prev);
				const targetItems =
					Array.isArray(itemsArray) ? itemsArray
					: Array.isArray(items) ? items
					: [];

				targetItems.forEach((item) => {
					newSet.add(getValue(item, field));
				});

				return newSet;
			});
		},
		[items, field],
	);

	const hideAll = useCallback(
		(itemsArray?: VisibilityId[] | T[]) => {
			setVisibleIds((prev) => {
				const newSet = new Set(prev);
				const targetItems =
					Array.isArray(itemsArray) ? itemsArray
					: Array.isArray(items) ? items
					: [];

				targetItems.forEach((item) => {
					newSet.delete(getValue(item, field));
				});

				return newSet;
			});
		},
		[items, field],
	);

	const resetVisibility = useCallback(() => {
		setVisibleIds(() => new Set(initialIdsRef.current));
	}, []);

	const replaceVisibility = useCallback(
		(newVisibleItems: VisibilityId[] | T[]) => {
			const safeNewVisibleItems =
				Array.isArray(newVisibleItems) ? newVisibleItems : [];
			const newItemIds: VisibilityId[] = safeNewVisibleItems.map((item) =>
				getValue(item, field),
			);

			setVisibleIds(() => new Set(newItemIds));
		},
		[field],
	);

	const visibleItems = useMemo(() => {
		const safeItems = Array.isArray(items) ? items : [];
		return safeItems.filter((item) => {
			const itemId = getValue(item, field);

			return visibleIds.has(itemId);
		});
	}, [items, field, visibleIds]);

	const hiddenItems = useMemo(() => {
		const safeItems = Array.isArray(items) ? items : [];
		return safeItems.filter((item) => {
			const itemId = getValue(item, field);

			return !visibleIds.has(itemId);
		});
	}, [items, field, visibleIds]);

	return {
		visibleIds: [...visibleIds],
		visibleItems,
		hiddenItems,
		visibleCount: visibleIds.size,
		isVisible,
		show,
		hide,
		toggleVisibility,
		showAll,
		hideAll,
		replaceVisibility,
		resetVisibility,
	};
}

export { type UseVisibilityReturn, useVisibility };
