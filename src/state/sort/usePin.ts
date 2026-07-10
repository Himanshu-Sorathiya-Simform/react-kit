import { useCallback, useMemo, useState } from "react";
import { getValue } from "../../shared/utils.ts";

interface UsePinReturn<T> {
	pinnedIds: (string | number)[];
	pinnedItems: T[];
	unpinnedItems: T[];
	pinnedCount: number;
	hasPins: boolean;
	isAtMaxLimit: boolean;
	pin: (itemOrId: string | number | T) => void;
	unpin: (itemOrId: string | number | T) => void;
	togglePin: (itemOrId: string | number | T) => void;
	isPinned: (itemOrId: string | number | T) => boolean;
	clearPins: () => void;
	resetPins: () => void;
	replacePins: (newPinnedItems: (string | number)[] | T[]) => void;
	pinMultiple: (newItems: (string | number)[] | T[]) => void;
	unpinMultiple: (itemsToRemove: (string | number)[] | T[]) => void;
}

function usePin<T = unknown>({
	items,
	field,
	initialPinnedIds = [],
	maxPins = Number.MAX_SAFE_INTEGER,
}: {
	items: T[];
	field?: string;
	initialPinnedIds?: (string | number)[];
	maxPins?: number;
}): UsePinReturn<T> {
	const [pinnedIds, setPinnedIds] = useState(new Set(initialPinnedIds));

	const pin = useCallback(
		(itemOrId: number | string | T) => {
			setPinnedIds((prev) => {
				if (prev.size >= maxPins) return prev;

				const newSet = new Set(prev);
				const idToAdd = getValue(itemOrId, field);

				newSet.add(idToAdd);

				return newSet;
			});
		},
		[field, maxPins],
	);

	const unpin = useCallback(
		(itemOrId: number | string | T) => {
			setPinnedIds((prev) => {
				const newSet = new Set(prev);
				const idToRemove = getValue(itemOrId, field);

				newSet.delete(idToRemove);

				return newSet;
			});
		},
		[field],
	);

	const togglePin = useCallback(
		(itemOrId: number | string | T) => {
			setPinnedIds((prev) => {
				const newSet = new Set(prev);
				const idToToggle = getValue(itemOrId, field);

				if (newSet.has(idToToggle)) {
					newSet.delete(idToToggle);
				} else {
					if (newSet.size >= maxPins) return prev;
					newSet.add(idToToggle);
				}

				return newSet;
			});
		},
		[field, maxPins],
	);

	const isPinned = useCallback(
		(itemOrId: number | string | T) => {
			const idToCheck = getValue(itemOrId, field);

			return pinnedIds.has(idToCheck);
		},
		[pinnedIds, field],
	);

	const clearPins = useCallback(() => setPinnedIds(new Set()), []);

	const resetPins = useCallback(
		() => setPinnedIds(new Set(initialPinnedIds)),
		[initialPinnedIds],
	);

	const replacePins = useCallback(
		(newPinnedItems: (number | string)[] | T[]) => {
			const newPinnedItemIds: (string | number)[] = newPinnedItems.map(
				(item) => getValue(item, field),
			);

			setPinnedIds(new Set(newPinnedItemIds.slice(0, maxPins)));
		},
		[field, maxPins],
	);

	const pinMultiple = useCallback(
		(newItems: (string | number)[] | T[]) => {
			setPinnedIds((prev) => {
				const newSet = new Set(prev);
				const itemIdsToAdd: (string | number)[] = newItems.map((item) =>
					getValue(item, field),
				);

				for (const id of itemIdsToAdd) {
					if (newSet.size >= maxPins && !newSet.has(id)) break;

					newSet.add(id);
				}

				return newSet;
			});
		},
		[field, maxPins],
	);

	const unpinMultiple = useCallback(
		(itemsToRemove: (string | number)[] | T[]) => {
			setPinnedIds((prev) => {
				const newSet = new Set(prev);
				const itemIdsToRemove: (string | number)[] = itemsToRemove.map(
					(item) => getValue(item, field),
				);

				itemIdsToRemove.forEach((id) => newSet.delete(id));

				return newSet;
			});
		},
		[field],
	);

	const pinnedItems = useMemo(() => {
		return items.filter((item) => {
			const itemId = getValue(item, field);

			return pinnedIds.has(itemId);
		});
	}, [items, field, pinnedIds]);

	const unpinnedItems = useMemo(() => {
		return items.filter((item) => {
			const itemId = getValue(item, field);

			return !pinnedIds.has(itemId);
		});
	}, [items, field, pinnedIds]);

	return {
		pinnedIds: [...pinnedIds],
		pinnedItems,
		unpinnedItems,
		pinnedCount: pinnedIds.size,
		hasPins: pinnedIds.size > 0,
		isAtMaxLimit: pinnedIds.size >= maxPins,
		pin,
		unpin,
		togglePin,
		isPinned,
		clearPins,
		resetPins,
		replacePins,
		pinMultiple,
		unpinMultiple,
	};
}

export { type UsePinReturn, usePin };
