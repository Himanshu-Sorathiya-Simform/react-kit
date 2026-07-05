import { useCallback, useState } from "react";

interface UseSingleSelectionReturn {
	selectedId: string | number | undefined;
	hasSelection: boolean;
	select: (id: string | number) => void;
	deselect: () => void;
	toggle: (id: string | number) => void;
	isSelected: (id: string | number) => boolean;
	resetSelection: () => void;
}

function useSingleSelection(
	initialSelectedId?: number | string,
): UseSingleSelectionReturn {
	const [selectedId, setSelectedId] = useState(initialSelectedId);

	const select = useCallback((id: number | string) => setSelectedId(id), []);

	const deselect = useCallback(() => setSelectedId(undefined), []);

	const toggle = useCallback(
		(id: number | string) =>
			setSelectedId((prev) => (prev === id ? undefined : id)),
		[],
	);

	const isSelected = useCallback(
		(id: number | string) => selectedId === id,
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
