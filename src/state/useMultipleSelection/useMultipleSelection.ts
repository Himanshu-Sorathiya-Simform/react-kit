import { useCallback, useMemo, useRef, useState } from "react";
import { getValue } from "../../shared/utils.ts";

type SelectionId = string | number;

interface UseMultipleSelectionReturn<T> {
	selectedIds: SelectionId[];
	selectedCount: number;
	selectedItems: T[];
	isEmpty: boolean;
	select: (item: SelectionId | T) => void;
	deselect: (item: SelectionId | T) => void;
	toggle: (item: SelectionId | T) => void;
	isSelected: (item: SelectionId | T) => boolean;
	resetSelection: () => void;
	replaceSelection: (newSelectedItems: SelectionId[] | T[]) => void;
	selectAll: () => void;
	deselectAll: () => void;
	toggleAll: () => void;
	invertSelection: () => void;
	selectMultiple: (newItems: SelectionId[] | T[]) => void;
	deselectMultiple: (itemsToRemove: SelectionId[] | T[]) => void;
	retainOnly: (itemsToRetain: SelectionId[] | T[]) => void;
}

function useMultipleSelection<T = unknown>(
	options: {
		items?: T[];
		field?: string;
		initialSelectedIds?: SelectionId[];
	} = {},
): UseMultipleSelectionReturn<T> {
	const safeOptions = options || {};

	const items = useMemo(
		() => (Array.isArray(safeOptions.items) ? safeOptions.items : []),
		[safeOptions.items],
	);
	const initialSelectedIds =
		Array.isArray(safeOptions.initialSelectedIds) ?
			safeOptions.initialSelectedIds
		:	[];
	const field = safeOptions.field;

	const initialSelectedIdsRef = useRef(initialSelectedIds);

	const [selectedIds, setSelectedIds] = useState(
		() => new Set(initialSelectedIds),
	);

	const select = useCallback(
		(item: SelectionId | T) => {
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
		(item: SelectionId | T) => {
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
		(item: SelectionId | T) => {
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
		(item: SelectionId | T) => {
			const itemIdToCheck = getValue(item, field);

			return selectedIds.has(itemIdToCheck);
		},
		[selectedIds, field],
	);

	const resetSelection = useCallback(
		() => setSelectedIds(new Set(initialSelectedIdsRef.current)),
		[],
	);

	const replaceSelection = useCallback(
		(newSelectedItems: SelectionId[] | T[]) => {
			const safeNewItems =
				Array.isArray(newSelectedItems) ? newSelectedItems : [];
			const newSelectedItemsId: SelectionId[] = safeNewItems.map((item) =>
				getValue(item, field),
			);

			setSelectedIds(new Set(newSelectedItemsId));
		},
		[field],
	);

	const selectAll = useCallback(() => {
		const AllItemsId: SelectionId[] = items.map((item) => getValue(item, field));

		setSelectedIds(new Set(AllItemsId));
	}, [items, field]);

	const deselectAll = useCallback(() => {
		setSelectedIds(new Set());
	}, []);

	const toggleAll = useCallback(
		() =>
			setSelectedIds((prev) => {
				if (prev.size === items.length) return new Set();

				const allItemsIds: SelectionId[] = items.map((item) =>
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

				const notSelectedItemIds: SelectionId[] = items
					.filter((item) => !prev.has(getValue(item, field)))
					.map((item) => getValue(item, field));

				return new Set(notSelectedItemIds);
			}),
		[items, field],
	);

	const selectMultiple = useCallback(
		(newItems: SelectionId[] | T[]) => {
			setSelectedIds((prev) => {
				const newSet = new Set(prev);
				const safeNewItems = Array.isArray(newItems) ? newItems : [];

				const newItemIdsToAdd: SelectionId[] = safeNewItems.map((item) =>
					getValue(item, field),
				);
				newItemIdsToAdd.forEach((field) => newSet.add(field));

				return newSet;
			});
		},
		[field],
	);

	const deselectMultiple = useCallback(
		(itemsToRemove: SelectionId[] | T[]) => {
			setSelectedIds((prev) => {
				const newSet = new Set(prev);
				const safeItemsToRemove =
					Array.isArray(itemsToRemove) ? itemsToRemove : [];

				const newItemIdsToRemove: SelectionId[] = safeItemsToRemove.map(
					(item) => getValue(item, field),
				);
				newItemIdsToRemove.forEach((field) => newSet.delete(field));

				return newSet;
			});
		},
		[field],
	);

	const retainOnly = useCallback(
		(itemsToRetain: SelectionId[] | T[]) => {
			setSelectedIds((prev) => {
				const newSet = new Set<SelectionId>();
				const safeItemsToRetain =
					Array.isArray(itemsToRetain) ? itemsToRetain : [];

				const newItemIdsToRetain: SelectionId[] = safeItemsToRetain.map(
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
