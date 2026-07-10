import { useCallback, useRef, useState } from "react";

interface UseOrderReturn<T> {
	orderedItems: T[];
	moveUp: (index: number) => void;
	moveDown: (index: number) => void;
	canMoveUp: (index: number) => boolean;
	canMoveDown: (index: number) => boolean;
	moveToTop: (index: number) => void;
	moveToBottom: (index: number) => void;
	move: (fromIndex: number, toIndex: number) => void;
	swap: (indexA: number, indexB: number) => void;
	resetOrder: () => void;
	replaceOrder: (newOrderedItems: T[]) => void;
}

function useOrder<T>(initialItems: T[]): UseOrderReturn<T> {
	const initialItemsRef = useRef(initialItems);

	const [orderedItems, setOrderedItems] = useState(() => initialItems);

	const moveUp = useCallback((index: number) => {
		if (typeof index !== "number") return;

		setOrderedItems((prev) => {
			if (index <= 0 || index >= prev.length) return prev;

			const copy = [...prev];
			[copy[index], copy[index - 1]] = [copy[index - 1]!, copy[index]!];

			return copy;
		});
	}, []);

	const moveDown = useCallback((index: number) => {
		if (typeof index !== "number") return;

		setOrderedItems((prev) => {
			if (index < 0 || index >= prev.length - 1) return prev;

			const copy = [...prev];
			[copy[index], copy[index + 1]] = [copy[index + 1]!, copy[index]!];

			return copy;
		});
	}, []);

	const canMoveUp = useCallback((index: number) => {
		return index > 0;
	}, []);

	const canMoveDown = useCallback(
		(index: number) => {
			return index < orderedItems.length - 1;
		},
		[orderedItems.length],
	);

	const moveToTop = useCallback((index: number) => {
		if (typeof index !== "number") return;

		setOrderedItems((prev) => {
			if (index <= 0 || index >= prev.length) return prev;

			const copy = [...prev];
			const [item] = copy.splice(index, 1);
			copy.unshift(item!);

			return copy;
		});
	}, []);

	const moveToBottom = useCallback((index: number) => {
		if (typeof index !== "number") return;

		setOrderedItems((prev) => {
			if (index < 0 || index >= prev.length - 1) return prev;

			const copy = [...prev];
			const [item] = copy.splice(index, 1);
			copy.push(item!);

			return copy;
		});
	}, []);

	const move = useCallback((fromIndex: number, toIndex: number) => {
		if (
			typeof fromIndex !== "number"
			|| typeof toIndex !== "number"
			|| fromIndex === toIndex
		)
			return;

		setOrderedItems((prev) => {
			if (
				fromIndex < 0
				|| fromIndex >= prev.length
				|| toIndex < 0
				|| toIndex >= prev.length
			)
				return prev;

			const copy = [...prev];
			const [item] = copy.splice(fromIndex, 1);
			copy.splice(toIndex, 0, item!);

			return copy;
		});
	}, []);

	const swap = useCallback((indexA: number, indexB: number) => {
		if (
			typeof indexA !== "number"
			|| typeof indexB !== "number"
			|| indexA === indexB
		)
			return;

		setOrderedItems((prev) => {
			if (
				indexA < 0
				|| indexA >= prev.length
				|| indexB < 0
				|| indexB >= prev.length
			)
				return prev;

			const copy = [...prev];
			[copy[indexA], copy[indexB]] = [copy[indexB]!, copy[indexA]!];

			return copy;
		});
	}, []);

	const resetOrder = useCallback(() => {
		setOrderedItems(initialItemsRef.current);
	}, []);

	const replaceOrder = useCallback((newOrderedItems: T[]) => {
		setOrderedItems(newOrderedItems);
	}, []);

	return {
		orderedItems,
		moveUp,
		moveDown,
		canMoveUp,
		canMoveDown,
		moveToTop,
		moveToBottom,
		move,
		swap,
		replaceOrder,
		resetOrder,
	};
}

export { type UseOrderReturn, useOrder };
