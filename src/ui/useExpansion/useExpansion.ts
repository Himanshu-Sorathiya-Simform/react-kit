import { useCallback, useMemo, useRef, useState } from "react";
import { getValue } from "../../shared/utils.ts";

type ExpansionId = string | number;

interface UseExpansionReturn<T> {
	expandedIds: ExpansionId[];
	expandedItems: T[];
	isExpanded: (itemOrId: ExpansionId | T) => boolean;
	expand: (itemOrId: ExpansionId | T) => void;
	collapse: (itemOrId: ExpansionId | T) => void;
	toggle: (itemOrId: ExpansionId | T) => void;
	expandAll: () => void;
	collapseAll: () => void;
	resetExpansion: () => void;
	replaceExpansion: (newExpandedItems: ExpansionId[] | T[]) => void;
}

function useExpansion<T = unknown>(
	options: {
		items?: T[];
		field?: string;
		initialExpandedIds?: ExpansionId[];
		multiple?: boolean;
	} = {},
): UseExpansionReturn<T> {
	const safeOptions = options || {};

	const items = useMemo(
		() => (Array.isArray(safeOptions.items) ? safeOptions.items : []),
		[safeOptions.items],
	);
	const initialExpandedIds =
		Array.isArray(safeOptions.initialExpandedIds) ?
			safeOptions.initialExpandedIds
		:	[];
	const field = safeOptions.field;
	const multiple = !!safeOptions.multiple;

	const initialIdsRef = useRef(initialExpandedIds);

	const [expandedIds, setExpandedIds] = useState(
		() => new Set(initialExpandedIds),
	);

	const isExpanded = useCallback(
		(itemOrId: ExpansionId | T) => {
			const idToCheck = getValue(itemOrId, field);

			return expandedIds.has(idToCheck);
		},
		[expandedIds, field],
	);

	const expand = useCallback(
		(itemOrId: ExpansionId | T) => {
			setExpandedIds((prev) => {
				const idToExpand = getValue(itemOrId, field);
				if (prev.has(idToExpand)) return prev;

				const newSet = multiple ? new Set(prev) : new Set<ExpansionId>();
				newSet.add(idToExpand);

				return newSet;
			});
		},
		[field, multiple],
	);

	const collapse = useCallback(
		(itemOrId: ExpansionId | T) => {
			setExpandedIds((prev) => {
				const idToCollapse = getValue(itemOrId, field);
				if (!prev.has(idToCollapse)) return prev;

				const newSet = new Set(prev);
				newSet.delete(idToCollapse);

				return newSet;
			});
		},
		[field],
	);

	const toggle = useCallback(
		(itemOrId: ExpansionId | T) => {
			setExpandedIds((prev) => {
				const idToToggle = getValue(itemOrId, field);
				const newSet = multiple ? new Set(prev) : new Set<ExpansionId>();

				if (prev.has(idToToggle)) {
					if (multiple) newSet.delete(idToToggle);
				} else {
					newSet.add(idToToggle);
				}

				return newSet;
			});
		},
		[field, multiple],
	);

	const expandAll = useCallback(() => {
		if (!multiple) return;

		const safeItems = Array.isArray(items) ? items : [];
		const allIds = safeItems.map((item) => getValue(item, field));

		setExpandedIds(new Set(allIds));
	}, [items, field, multiple]);

	const collapseAll = useCallback(() => {
		setExpandedIds(new Set());
	}, []);

	const resetExpansion = useCallback(() => {
		setExpandedIds(new Set(initialIdsRef.current));
	}, []);

	const replaceExpansion = useCallback(
		(newExpandedItems: ExpansionId[] | T[]) => {
			const safeNewItems =
				Array.isArray(newExpandedItems) ? newExpandedItems : [];
			const newExpandedItemsId: ExpansionId[] = safeNewItems.map((item) =>
				getValue(item, field),
			);

			setExpandedIds(new Set(newExpandedItemsId));
		},
		[field],
	);

	const expandedItems = useMemo(() => {
		const safeItems = Array.isArray(items) ? items : [];

		return safeItems.filter((item) => expandedIds.has(getValue(item, field)));
	}, [items, field, expandedIds]);

	return {
		expandedIds: [...expandedIds],
		expandedItems,
		isExpanded,
		expand,
		collapse,
		toggle,
		expandAll,
		collapseAll,
		resetExpansion,
		replaceExpansion,
	};
}

export { type UseExpansionReturn, useExpansion };
