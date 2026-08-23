import { useCallback, useMemo, useRef, useState } from "react";
import { getValue } from "../../shared/stateShared/utils.ts";
import type {
	OrderTarget,
	UseOrderBaseOptions,
	UseOrderFieldOptions,
} from "./types.ts";
import { resolveTarget, validateTargetInput } from "./validation.ts";

/**
 * Return value of {@link useOrder}.
 *
 * @typeParam T - The item shape.
 * @typeParam WithField - Whether `field` was configured - see {@link OrderTarget}.
 */
interface UseOrderReturn<T, WithField extends boolean = false> {
	/** The items in their current order. */
	orderedItems: readonly T[];

	/**
	 * Moves the item at `target` one position earlier (toward index `0`).
	 * @remarks No-ops at the start of the list, or if `target`'s item or the item before it is disabled.
	 */
	movePrevious: (target: OrderTarget<T, WithField>) => void;

	/**
	 * Moves the item at `target` one position later (toward the end).
	 * @remarks No-ops at the end of the list, or if `target`'s item or the item after it is disabled.
	 */
	moveNext: (target: OrderTarget<T, WithField>) => void;

	/** Whether {@link UseOrderReturn.movePrevious} would currently have an effect for `target`. */
	canMovePrevious: (target: OrderTarget<T, WithField>) => boolean;

	/** Whether {@link UseOrderReturn.moveNext} would currently have an effect for `target`. */
	canMoveNext: (target: OrderTarget<T, WithField>) => boolean;

	/**
	 * Moves the item at `target` to the very start of the list.
	 * @remarks No-ops if it's already first, or if it's disabled. Items it moves past are shifted by one slot but not themselves checked - see {@link useOrder}'s remarks.
	 */
	moveToStart: (target: OrderTarget<T, WithField>) => void;

	/**
	 * Moves the item at `target` to the very end of the list.
	 * @remarks No-ops if it's already last, or if it's disabled. Items it moves past are shifted by one slot but not themselves checked - see {@link useOrder}'s remarks.
	 */
	moveToEnd: (target: OrderTarget<T, WithField>) => void;

	/**
	 * Moves the item at `from` to the position at `to`, shifting everything
	 * in between by one slot.
	 * @remarks No-ops if `from` and `to` resolve to the same index, or if the item at `from` is disabled. Items shifted in between are not themselves checked - see {@link useOrder}'s remarks.
	 */
	move: (from: OrderTarget<T, WithField>, to: OrderTarget<T, WithField>) => void;

	/**
	 * Exchanges the positions of the items at `a` and `b`.
	 * @remarks No-ops if `a` and `b` resolve to the same index, or if either item is disabled.
	 */
	swap: (a: OrderTarget<T, WithField>, b: OrderTarget<T, WithField>) => void;

	/** Restores the order to the value `initialItems` had at mount - see {@link useOrder}'s remarks. */
	resetOrder: () => void;

	/** Replaces the entire order with exactly these items. */
	replaceOrder: (newOrderedItems: readonly T[]) => void;
}

/**
 * Manages the order of a list of items - drag-to-reorder UIs, "move
 * up"/"move down" controls, manual sort overrides layered on top of a base
 * sort.
 *
 * @remarks
 * - Uncontrolled only for now - controlled mode is planned separately and
 *   will be added without breaking this signature.
 * - SSR-safe: performs no DOM/window access; `initialItems` must be
 *   deterministic between server and client renders to avoid hydration
 *   mismatches.
 * - All returned callbacks are manually memoized with `useCallback` so this
 *   hook is safe to use even in codebases **without** the React Compiler.
 * - Two overloads, picked by whether `field` is configured: without it,
 *   every method's `target` parameter is a plain `number` index; with it,
 *   `target` also accepts a full item, resolved to its current index via
 *   `field`. See {@link OrderTarget} for why this is gated behind `field`
 *   rather than always allowed.
 * - `isDisabled` blocks differently depending on the operation. For the
 *   pairwise operations (`movePrevious`, `moveNext`, `swap`), *both* items
 *   involved must be movable, since both change position. For the
 *   repositioning operations (`moveToStart`, `moveToEnd`, `move`), only the
 *   item being moved is checked - items it displaces shift by one slot but
 *   are never asked to swap places, so their own `isDisabled` state isn't
 *   consulted for the move to proceed.
 * - `resetOrder` restores the value `initialItems` had at mount, not
 *   whatever it is on the current render - a later change to the
 *   `initialItems` prop doesn't retroactively change what `resetOrder`
 *   restores to.
 *
 * @typeParam T - The item shape.
 * @param initialItems - The items to manage, in their starting order.
 * @param options - See {@link UseOrderBaseOptions} / {@link UseOrderFieldOptions}.
 * @returns The current order and the actions to change it. See {@link UseOrderReturn}.
 *
 * @example
 * Index-only:
 * ```tsx
 * const { orderedItems, movePrevious, moveNext } = useOrder(["a", "b", "c"]);
 * ```
 *
 * @example
 * With `field`, so items themselves can be passed as move targets:
 * ```tsx
 * interface Row { id: string; label: string }
 * const { orderedItems, movePrevious } = useOrder<Row>(rows, { field: "id" });
 * // movePrevious(rows[2]) works directly - no manual index lookup needed
 * ```
 */
function useOrder<T extends Record<string, unknown>>(
	initialItems: readonly T[] | undefined,
	options: UseOrderFieldOptions<T>,
): UseOrderReturn<T, true>;
function useOrder<T>(
	initialItems?: readonly T[],
	options?: UseOrderBaseOptions<T>,
): UseOrderReturn<T, false>;
function useOrder<T>(
	initialItems: readonly T[] = [],
	options?: UseOrderBaseOptions<T> & { field?: string },
): UseOrderReturn<T, boolean> {
	const { isDisabled, field } = options ?? {};

	const safeInitialItems = useMemo(
		() => (Array.isArray(initialItems) ? initialItems : []),
		[initialItems],
	);
	const initialItemsRef = useRef(safeInitialItems);

	const [orderedItems, setOrderedItems] = useState<readonly T[]>(
		() => safeInitialItems,
	);

	// O(1) id→index lookup, for the read-only canMove* predicates only - the
	// mutators below never use this map, and instead re-resolve against
	// `prev` fresh on every call. This map is only as current as the last
	// committed render; resolving a mutation against it from inside a
	// setOrderedItems updater could silently act on a stale index if two
	// mutations are queued in the same tick before a re-render happens.
	const idToIndexMap = useMemo(() => {
		if (!field) return undefined;

		const map = new Map<unknown, number>();

		orderedItems.forEach((item, index) => {
			map.set(getValue(item, field), index);
		});

		return map;
	}, [orderedItems, field]);

	const movePrevious = useCallback(
		(target: number | T) => {
			if (!validateTargetInput(target, field, "movePrevious")) return;

			setOrderedItems((prev) => {
				const resolved = resolveTarget(
					target,
					prev,
					field,
					"movePrevious",
					true,
				);
				if (resolved === undefined || resolved === 0) return prev;

				const targetIndex = resolved - 1;

				if (
					isDisabled?.(prev[resolved]!, resolved)
					|| isDisabled?.(prev[targetIndex]!, targetIndex)
				)
					return prev;

				const copy = [...prev];
				[copy[resolved], copy[targetIndex]] = [
					copy[targetIndex]!,
					copy[resolved]!,
				];

				return copy;
			});
		},
		[isDisabled, field],
	);

	const moveNext = useCallback(
		(target: number | T) => {
			if (!validateTargetInput(target, field, "moveNext")) return;

			setOrderedItems((prev) => {
				const resolved = resolveTarget(
					target,
					prev,
					field,
					"moveNext",
					true,
				);
				if (resolved === undefined || resolved === prev.length - 1)
					return prev;

				const targetIndex = resolved + 1;

				if (
					isDisabled?.(prev[resolved]!, resolved)
					|| isDisabled?.(prev[targetIndex]!, targetIndex)
				)
					return prev;

				const copy = [...prev];
				[copy[resolved], copy[targetIndex]] = [
					copy[targetIndex]!,
					copy[resolved]!,
				];

				return copy;
			});
		},
		[isDisabled, field],
	);

	const canMovePrevious = useCallback(
		(target: number | T) => {
			if (!validateTargetInput(target, field, "canMovePrevious")) return false;

			const resolved = resolveTarget(
				target,
				orderedItems,
				field,
				"canMovePrevious",
				false,
				idToIndexMap,
			);
			if (resolved === undefined || resolved === 0) return false;

			const targetIndex = resolved - 1;

			return !(
				isDisabled?.(orderedItems[resolved]!, resolved)
				|| isDisabled?.(orderedItems[targetIndex]!, targetIndex)
			);
		},
		[orderedItems, isDisabled, field, idToIndexMap],
	);

	const canMoveNext = useCallback(
		(target: number | T) => {
			if (!validateTargetInput(target, field, "canMoveNext")) return false;

			const resolved = resolveTarget(
				target,
				orderedItems,
				field,
				"canMoveNext",
				false,
				idToIndexMap,
			);
			if (resolved === undefined || resolved === orderedItems.length - 1)
				return false;

			const targetIndex = resolved + 1;

			return !(
				isDisabled?.(orderedItems[resolved]!, resolved)
				|| isDisabled?.(orderedItems[targetIndex]!, targetIndex)
			);
		},
		[orderedItems, isDisabled, field, idToIndexMap],
	);

	const moveToStart = useCallback(
		(target: number | T) => {
			if (!validateTargetInput(target, field, "moveToStart")) return;

			setOrderedItems((prev) => {
				const resolved = resolveTarget(
					target,
					prev,
					field,
					"moveToStart",
					true,
				);
				if (resolved === undefined || resolved === 0) return prev;
				// Only the moved item's own disabled state blocks this - items
				// between it and the start are shifted by one slot, not swapped,
				// so they're not asked whether they're movable.
				if (isDisabled?.(prev[resolved]!, resolved)) return prev;

				const copy = [...prev];
				const [item] = copy.splice(resolved, 1);
				copy.unshift(item!);

				return copy;
			});
		},
		[isDisabled, field],
	);

	const moveToEnd = useCallback(
		(target: number | T) => {
			if (!validateTargetInput(target, field, "moveToEnd")) return;

			setOrderedItems((prev) => {
				const resolved = resolveTarget(
					target,
					prev,
					field,
					"moveToEnd",
					true,
				);
				if (resolved === undefined || resolved === prev.length - 1)
					return prev;
				if (isDisabled?.(prev[resolved]!, resolved)) return prev;

				const copy = [...prev];
				const [item] = copy.splice(resolved, 1);
				copy.push(item!);

				return copy;
			});
		},
		[isDisabled, field],
	);

	const move = useCallback(
		(from: number | T, to: number | T) => {
			if (
				!validateTargetInput(from, field, "move(from)")
				|| !validateTargetInput(to, field, "move(to)")
			)
				return;

			setOrderedItems((prev) => {
				const resolvedFrom = resolveTarget(
					from,
					prev,
					field,
					"move(from)",
					true,
				);
				const resolvedTo = resolveTarget(to, prev, field, "move(to)", true);

				if (
					resolvedFrom === undefined
					|| resolvedTo === undefined
					|| resolvedFrom === resolvedTo
				)
					return prev;

				if (isDisabled?.(prev[resolvedFrom]!, resolvedFrom)) return prev;

				const copy = [...prev];
				const [item] = copy.splice(resolvedFrom, 1);
				copy.splice(resolvedTo, 0, item!);

				return copy;
			});
		},
		[isDisabled, field],
	);

	const swap = useCallback(
		(a: number | T, b: number | T) => {
			if (
				!validateTargetInput(a, field, "swap(a)")
				|| !validateTargetInput(b, field, "swap(b)")
			)
				return;

			setOrderedItems((prev) => {
				const resolvedA = resolveTarget(a, prev, field, "swap(a)", true);
				const resolvedB = resolveTarget(b, prev, field, "swap(b)", true);

				if (
					resolvedA === undefined
					|| resolvedB === undefined
					|| resolvedA === resolvedB
				)
					return prev;

				if (
					isDisabled?.(prev[resolvedA]!, resolvedA)
					|| isDisabled?.(prev[resolvedB]!, resolvedB)
				)
					return prev;

				const copy = [...prev];
				[copy[resolvedA], copy[resolvedB]] = [
					copy[resolvedB]!,
					copy[resolvedA]!,
				];

				return copy;
			});
		},
		[isDisabled, field],
	);

	const resetOrder = useCallback(() => {
		setOrderedItems(initialItemsRef.current);
	}, []);

	const replaceOrder = useCallback((newOrderedItems: readonly T[]) => {
		const safeNewItems = Array.isArray(newOrderedItems) ? newOrderedItems : [];

		setOrderedItems(safeNewItems);
	}, []);

	return {
		orderedItems,
		movePrevious,
		moveNext,
		canMovePrevious,
		canMoveNext,
		moveToStart,
		moveToEnd,
		move,
		swap,
		resetOrder,
		replaceOrder,
	};
}

export { type UseOrderReturn, useOrder };
