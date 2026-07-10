import { useCallback, useState } from "react";

type SelectionId = string | number;

interface UseSingleSelectionReturn {
	selectedId: SelectionId | undefined;
	hasSelection: boolean;
	select: (id: SelectionId) => void;
	deselect: () => void;
	toggle: (id: SelectionId) => void;
	isSelected: (id: SelectionId) => boolean;
	resetSelection: () => void;
}

function useSingleSelection(
	initialSelectedId?: SelectionId,
): UseSingleSelectionReturn {
	const [selectedId, setSelectedId] = useState(initialSelectedId);

	const select = useCallback((id: SelectionId) => setSelectedId(id), []);

	const deselect = useCallback(() => setSelectedId(undefined), []);

	const toggle = useCallback(
		(id: SelectionId) => setSelectedId((prev) => (prev === id ? undefined : id)),
		[],
	);

	const isSelected = useCallback(
		(id: SelectionId) => selectedId === id,
		[selectedId],
	);

	const resetSelection = useCallback(
		() => setSelectedId(initialSelectedId),
		[initialSelectedId],
	);

	return {
		selectedId,
		hasSelection: !!selectedId,
		select,
		deselect,
		toggle,
		isSelected,
		resetSelection,
	};
}

export { type UseSingleSelectionReturn, useSingleSelection };
