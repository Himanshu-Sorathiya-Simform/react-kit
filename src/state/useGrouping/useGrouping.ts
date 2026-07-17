import { useCallback, useMemo, useState } from "react";
import { getValue } from "../../shared/utils.ts";
import type { Group } from "./types.ts";

interface UseGroupingReturn<T> {
	groupedRecord: Record<string, T[]>;
	groupedArray: Group<T>[];
	groupKeys: string[];
	totalGroups: number;
	activeGroupBy: string | undefined;
	changeGroupBy: (newField: string) => void;
	clearGrouping: () => void;
	resetGrouping: () => void;
	getGroupItems: (groupKey: string) => T[];
}

function useGrouping<T = unknown>(
	options: {
		items?: T[];
		initialGroupBy?: string;
	} = {},
): UseGroupingReturn<T> {
	const safeOptions = options || {};

	const items = useMemo(
		() => (Array.isArray(safeOptions.items) ? safeOptions.items : []),
		[safeOptions.items],
	);
	const initialGroupBy = safeOptions.initialGroupBy;

	const [activeGroupBy, setActiveGroupBy] = useState(initialGroupBy);

	const groupedRecord = useMemo(() => {
		if (!activeGroupBy) {
			return { Ungrouped: items } as Record<string, T[]>;
		}

		return items.reduce(
			(accumulator, item) => {
				const rawValue = getValue(item, activeGroupBy);

				const groupKey = rawValue != null ? String(rawValue) : "Unknown";

				if (!accumulator[groupKey]) {
					accumulator[groupKey] = [];
				}

				accumulator[groupKey].push(item);

				return accumulator;
			},
			{} as Record<string, T[]>,
		);
	}, [items, activeGroupBy]);

	const groupedArray = useMemo(() => {
		return Object.keys(groupedRecord).map((key) => ({
			key,
			items: groupedRecord[key]!,
		}));
	}, [groupedRecord]);

	const groupKeys = useMemo(() => {
		return Object.keys(groupedRecord);
	}, [groupedRecord]);

	const changeGroupBy = useCallback((newField: string) => {
		setActiveGroupBy(newField);
	}, []);

	const clearGrouping = useCallback(() => {
		setActiveGroupBy(undefined);
	}, []);

	const resetGrouping = useCallback(() => {
		setActiveGroupBy(initialGroupBy);
	}, [initialGroupBy]);

	const getGroupItems = useCallback(
		(groupKey: string) => {
			return groupedRecord[groupKey] || [];
		},
		[groupedRecord],
	);

	return {
		groupedRecord,
		groupedArray,
		groupKeys,
		totalGroups: groupKeys.length,
		activeGroupBy,
		changeGroupBy,
		clearGrouping,
		resetGrouping,
		getGroupItems,
	};
}

export { type UseGroupingReturn, useGrouping };
