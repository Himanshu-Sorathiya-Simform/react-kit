import { useCallback, useMemo, useState } from "react";
import { getValue } from "../../shared/utils.ts";

interface UseMultipleSelectionReturn<T> {
	selectedIds: (string | number)[];
	selectedCount: number;
	selectedItems: T[];
	isEmpty: boolean;
	select: (item: string | number | T) => void;
	deselect: (item: string | number | T) => void;
	toggle: (item: string | number | T) => void;
	isSelected: (item: string | number | T) => boolean;
	replaceSelection: (newSelectedItems: (string | number)[] | T[]) => void;
	resetSelection: () => void;
	selectAll: () => void;
	deselectAll: () => void;
	toggleAll: () => void;
	invertSelection: () => void;
	selectMultiple: (newItems: (string | number)[] | T[]) => void;
	deselectMultiple: (itemsToRemove: (string | number)[] | T[]) => void;
	retainOnly: (itemsToRetain: (string | number)[] | T[]) => void;
}

function useMultipleSelection<T = unknown>({
	items,
	field,
	initialSelectedIds = [],
}: {
	items: T[];
	field?: string;
	initialSelectedIds?: (number | string)[];
}): UseMultipleSelectionReturn<T> {
	const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds));

	const select = useCallback(
		(item: number | string | T) => {
			setSelectedIds((prev) => {
				const newSet = new Set(prev);

				const itemIdToAdd = getValue(item, field);
				newSet.add(itemIdToAdd);

				return newSet;
			});
		},
		[field],
	);

	const deselect = useCallback(
		(item: number | string | T) => {
			setSelectedIds((prev) => {
				const newSet = new Set(prev);

				const itemIdToRemove = getValue(item, field);
				newSet.delete(itemIdToRemove);

				return newSet;
			});
		},
		[field],
	);

	const toggle = useCallback(
		(item: number | string | T) => {
			setSelectedIds((prev) => {
				const newSet = new Set(prev);

				const itemIdToToggle = getValue(item, field);
				if (newSet.has(itemIdToToggle)) newSet.delete(itemIdToToggle);
				else newSet.add(itemIdToToggle);

				return newSet;
			});
		},
		[field],
	);

	const isSelected = useCallback(
		(item: number | string | T) => {
			const itemIdToCheck = getValue(item, field);

			return selectedIds.has(itemIdToCheck);
		},
		[selectedIds, field],
	);

	const replaceSelection = useCallback(
		(newSelectedItems: (number | string)[] | T[]) => {
			const newSelectedItemsId: (string | number)[] = newSelectedItems.map(
				(item) => getValue(item, field),
			);

			setSelectedIds(new Set(newSelectedItemsId));
		},
		[field],
	);

	const resetSelection = useCallback(
		() => setSelectedIds(new Set(initialSelectedIds)),
		[initialSelectedIds],
	);

	const selectAll = useCallback(() => {
		const AllItemsId: (string | number)[] = items.map((item) =>
			getValue(item, field),
		);

		setSelectedIds(new Set(AllItemsId));
	}, [items, field]);

	const deselectAll = useCallback(() => {
		setSelectedIds(new Set());
	}, []);

	const toggleAll = useCallback(
		() =>
			setSelectedIds((prev) => {
				if (prev.size === items.length) return new Set();

				const allItemsIds: (string | number)[] = items.map((item) =>
					getValue(item, field),
				);

				return new Set(allItemsIds);
			}),
		[items, field],
	);

	const invertSelection = useCallback(
		() =>
			setSelectedIds((prev) => {
				if (prev.size === items.length) return new Set();

				const notSelectedItemIds: (string | number)[] = items
					.filter((item) => !prev.has(getValue(item, field)))
					.map((item) => getValue(item, field));

				return new Set(notSelectedItemIds);
			}),
		[items, field],
	);

	const selectMultiple = useCallback(
		(newItems: (string | number)[] | T[]) => {
			setSelectedIds((prev) => {
				const newSet = new Set(prev);

				const newItemIdsToAdd: (string | number)[] = newItems.map((item) =>
					getValue(item, field),
				);
				newItemIdsToAdd.forEach((field) => newSet.add(field));

				return newSet;
			});
		},
		[field],
	);

	const deselectMultiple = useCallback(
		(itemsToRemove: (string | number)[] | T[]) => {
			setSelectedIds((prev) => {
				const newSet = new Set(prev);

				const newItemIdsToRemove: (string | number)[] = itemsToRemove.map(
					(item) => getValue(item, field),
				);
				newItemIdsToRemove.forEach((field) => newSet.delete(field));

				return newSet;
			});
		},
		[field],
	);

	const retainOnly = useCallback(
		(itemsToRetain: (string | number)[] | T[]) => {
			setSelectedIds((prev) => {
				const newSet = new Set<number | string>();

				const newItemIdsToRetain: (string | number)[] = itemsToRetain.map(
					(item) => getValue(item, field),
				);
				newItemIdsToRetain.forEach(
					(field) => prev.has(field) && newSet.add(field),
				);

				return newSet;
			});
		},
		[field],
	);

	const selectedItems = useMemo(() => {
		return items.filter((item) => {
			const itemId = getValue(item, field);

			return selectedIds.has(itemId);
		});
	}, [items, field, selectedIds]);

	return {
		selectedIds: [...selectedIds],
		selectedCount: selectedIds.size,
		selectedItems,
		isEmpty: selectedIds.size === 0,
		select,
		deselect,
		toggle,
		isSelected,
		replaceSelection,
		resetSelection,
		selectAll,
		deselectAll,
		toggleAll,
		invertSelection,
		selectMultiple,
		deselectMultiple,
		retainOnly,
	};
}

export { type UseMultipleSelectionReturn, useMultipleSelection };
