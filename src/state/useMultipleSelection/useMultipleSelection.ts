import { useCallback, useMemo, useState } from "react";
import { resolveSelectionId } from "../../shared/selectionShared/utils.ts";
import type { SelectionId, UseMultipleSelectionOptions } from "./types.ts";

/**
 * Return shape of {@link useMultipleSelection}.
 *
 * @typeParam T - The item shape.
 * @typeParam TId - The id type.
 */
interface UseMultipleSelectionReturn<
	T = SelectionId,
	TId extends SelectionId = SelectionId,
> {
	/**
	 * The currently selected ids.
	 *
	 * @remarks
	 * Ordered to match `items`' order whenever every selected id is present in
	 * `items`. If some selected ids aren't in the current `items` array (e.g.
	 * a previously-selected item that's since been filtered out, or an id
	 * selected directly without ever appearing in `items`), those "orphaned"
	 * ids are preserved and appended at the end, rather than silently dropped —
	 * this hook never discards selection state you didn't ask it to discard.
	 */
	selectedIds: readonly TId[];

	/** The number of currently selected ids (including any orphaned ones — see {@link UseMultipleSelectionReturn.selectedIds}). */
	selectedCount: number;

	/** The subset of `items` that are currently selected, in `items`' order. */
	selectedItems: readonly T[];

	/** Whether nothing at all is selected. */
	isEmpty: boolean;

	/**
	 * Whether every *selectable* (non-disabled) item in `items` is currently
	 * selected. `false` when `items` is empty. Intended for a "select all"
	 * checkbox's checked state.
	 */
	isAllSelected: boolean;

	/**
	 * Whether some, but not all, selectable items in `items` are selected.
	 * Intended for a "select all" checkbox's indeterminate state.
	 */
	isPartiallySelected: boolean;

	/**
	 * Adds `item` to the selection.
	 * @remarks No-ops if `item` resolves to a disabled id.
	 * @param item - A raw id, or a full item (requires `field` to have been configured).
	 */
	select: (item: TId | T) => void;

	/**
	 * Removes `item` from the selection. Always allowed, even for disabled ids.
	 * @param item - A raw id, or a full item.
	 */
	deselect: (item: TId | T) => void;

	/**
	 * Adds `item` if not selected, removes it if selected.
	 * @remarks The add-direction is blocked for disabled ids; the remove-direction never is.
	 * @param item - A raw id, or a full item.
	 */
	toggle: (item: TId | T) => void;

	/**
	 * Checks whether `item` is currently selected.
	 * @param item - A raw id, or a full item.
	 * @returns `true` if currently selected.
	 */
	isSelected: (item: TId | T) => boolean;

	/** Restores the selection to the current `defaultSelectedIds` (or empty, if none was provided). */
	reset: () => void;

	/**
	 * Replaces the entire selection with exactly these ids/items.
	 * @remarks Disabled ids are filtered out of the replacement set.
	 */
	replaceSelection: (newSelectedItems: readonly TId[] | readonly T[]) => void;

	/** Selects every selectable (non-disabled) item in `items`. */
	selectAll: () => void;

	/** Clears the entire selection, including any disabled-but-selected or orphaned ids. */
	deselectAll: () => void;

	/**
	 * If every selectable item in `items` is currently selected, clears the
	 * whole selection; otherwise selects every selectable item in `items`.
	 *
	 * @remarks
	 * Determined by actual set membership against every selectable item, not
	 * a size comparison — this stays correct even if `items` contains duplicate
	 * resolved ids, or the current selection contains ids no longer present in
	 * `items` (both of which would silently misfire a naive `prev.size === items.length` check).
	 */
	toggleAll: () => void;

	/** Selects every currently-unselected selectable item, and deselects everything else. */
	invertSelection: () => void;

	/**
	 * Adds multiple ids/items to the selection at once.
	 * @remarks Disabled ids are filtered out.
	 */
	selectMultiple: (newItems: readonly TId[] | readonly T[]) => void;

	/** Removes multiple ids/items from the selection at once. Always allowed. */
	deselectMultiple: (itemsToRemove: readonly TId[] | readonly T[]) => void;

	/** Keeps only the ids/items in `itemsToRetain` that are already selected (an intersection); never adds anything new. */
	retainOnly: (itemsToRetain: readonly TId[] | readonly T[]) => void;
}

/**
 * Manages multi-item selection state (e.g. checkboxes in a table, a
 * multi-select list, bulk-action UI).
 *
 * @remarks
 * - Uncontrolled only for now — controlled mode is planned separately and
 *   will be added without breaking this signature.
 * - SSR-safe: no DOM/window access; `defaultSelectedIds` must be deterministic
 *   between server and client renders to avoid hydration mismatches.
 * - All returned callbacks are manually memoized with `useCallback`/`useMemo`
 *   so this hook is safe to use even in codebases **without** the React Compiler.
 * - Works in two modes, picked by whether `T` is assignable to `TId`:
 *   - **id-only mode** (default): `useMultipleSelection()` — "items" are raw
 *     ids, no `field` needed.
 *   - **object mode**: `useMultipleSelection<Item, string>({ items, field: "id" })` —
 *     `field` is a type-checked dot-path into `Item` and is required.
 *
 * @typeParam T - The item shape (or `TId` itself, for id-only mode).
 * @typeParam TId - The id type. Defaults to `SelectionId`; narrow it for branded-id inference.
 * @param options - See {@link UseMultipleSelectionOptions}.
 * @returns The current selection state and the actions to mutate it. See {@link UseMultipleSelectionReturn}.
 *
 * @example
 * ```tsx
 * // id-only mode
 * const { selectedIds, toggle } = useMultipleSelection({ defaultSelectedIds: ["a"] });
 * ```
 *
 * @example
 * ```tsx
 * // object mode, with a nested field path and disabled rows
 * interface Row { id: string; locked: boolean }
 * const { selectedItems, toggleAll, isAllSelected, isPartiallySelected } = useMultipleSelection<Row, string>({
 *   items: rows,
 *   field: "id",
 *   isDisabled: (id) => rows.find((r) => r.id === id)?.locked ?? false,
 * });
 * ```
 */
function useMultipleSelection<
	T = SelectionId,
	TId extends SelectionId = SelectionId,
>(
	options: UseMultipleSelectionOptions<T, TId> = {} as UseMultipleSelectionOptions<
		T,
		TId
	>,
): UseMultipleSelectionReturn<T, TId> {
	const {
		items: rawItems,
		defaultSelectedIds: rawDefaultSelectedIds,
		isDisabled,
		field,
	} = options;

	const items = useMemo(
		() => (Array.isArray(rawItems) ? rawItems : ([] as readonly T[])),
		[rawItems],
	);

	const defaultSelectedIds = useMemo(
		() =>
			Array.isArray(rawDefaultSelectedIds) ? rawDefaultSelectedIds : (
				([] as readonly TId[])
			),
		[rawDefaultSelectedIds],
	);

	const [selectedIdsSet, setSelectedIdsSet] = useState<Set<TId>>(
		() => new Set(defaultSelectedIds),
	);

	// Resolve each item's id exactly once, keeping item+id paired together so
	// every derived value below can avoid re-deriving ids or doing index math.
	const itemsWithIds = useMemo(
		() =>
			items.map((item) => ({
				item,
				id: resolveSelectionId<T, TId>(item, field),
			})),
		[items, field],
	);

	const itemIds = useMemo(
		() => itemsWithIds.map((entry) => entry.id),
		[itemsWithIds],
	);

	/** `itemIds` minus anything `isDisabled` rejects — the basis for every bulk operation. */
	const selectableItemIds = useMemo(
		() => itemIds.filter((id) => !(isDisabled?.(id) ?? false)),
		[itemIds, isDisabled],
	);

	const selectedItems = useMemo(
		() =>
			itemsWithIds
				.filter((entry) => selectedIdsSet.has(entry.id))
				.map((entry) => entry.item),
		[itemsWithIds, selectedIdsSet],
	);

	const selectedIds = useMemo(() => {
		const orderedFromItems = itemIds.filter((id) => selectedIdsSet.has(id));

		if (orderedFromItems.length === selectedIdsSet.size) {
			// every selected id is accounted for in `items` — nothing orphaned
			return orderedFromItems;
		}

		const orderedSet = new Set(orderedFromItems);
		const orphaned: TId[] = [];

		selectedIdsSet.forEach((id) => {
			if (!orderedSet.has(id)) orphaned.push(id);
		});

		return [...orderedFromItems, ...orphaned];
	}, [itemIds, selectedIdsSet]);

	const isAllSelected = useMemo(
		() =>
			selectableItemIds.length > 0
			&& selectableItemIds.every((id) => selectedIdsSet.has(id)),
		[selectableItemIds, selectedIdsSet],
	);

	const isPartiallySelected = useMemo(
		() =>
			!isAllSelected && selectableItemIds.some((id) => selectedIdsSet.has(id)),
		[isAllSelected, selectableItemIds, selectedIdsSet],
	);

	const select = useCallback(
		(item: TId | T) => {
			const id = resolveSelectionId<T, TId>(item, field);
			if (isDisabled?.(id)) return;

			setSelectedIdsSet((prev) => {
				if (prev.has(id)) return prev; // already selected: skip the state update entirely

				const newSet = new Set(prev);
				newSet.add(id);

				return newSet;
			});
		},
		[field, isDisabled],
	);

	const deselect = useCallback(
		(item: TId | T) => {
			const id = resolveSelectionId<T, TId>(item, field);

			setSelectedIdsSet((prev) => {
				if (!prev.has(id)) return prev; // already absent: skip the state update entirely

				const newSet = new Set(prev);
				newSet.delete(id);

				return newSet;
			});
		},
		[field],
	);

	const toggle = useCallback(
		(item: TId | T) => {
			const id = resolveSelectionId<T, TId>(item, field);

			setSelectedIdsSet((prev) => {
				const isCurrentlySelected = prev.has(id);

				// Only the "would add" direction is guarded by isDisabled; toggling
				// a disabled-but-already-selected id off is always allowed.
				if (!isCurrentlySelected && isDisabled?.(id)) return prev;

				const newSet = new Set(prev);

				if (isCurrentlySelected) newSet.delete(id);
				else newSet.add(id);

				return newSet;
			});
		},
		[field, isDisabled],
	);

	const isSelected = useCallback(
		(item: TId | T) =>
			selectedIdsSet.has(resolveSelectionId<T, TId>(item, field)),
		[selectedIdsSet, field],
	);

	const reset = useCallback(
		() => setSelectedIdsSet(new Set(defaultSelectedIds)),
		[defaultSelectedIds],
	);

	const replaceSelection = useCallback(
		(newSelectedItems: readonly TId[] | readonly T[]) => {
			const safeItems =
				Array.isArray(newSelectedItems) ? newSelectedItems : [];

			const ids = safeItems.map((item) =>
				resolveSelectionId<T, TId>(item, field),
			);
			const filteredIds = ids.filter((id) => !(isDisabled?.(id) ?? false));

			setSelectedIdsSet(new Set(filteredIds));
		},
		[field, isDisabled],
	);

	const selectAll = useCallback(() => {
		setSelectedIdsSet(new Set(selectableItemIds));
	}, [selectableItemIds]);

	const deselectAll = useCallback(() => {
		setSelectedIdsSet((prev) => (prev.size === 0 ? prev : new Set()));
	}, []);

	const toggleAll = useCallback(() => {
		setSelectedIdsSet((prev) => {
			// Membership-based, not size-based: stays correct even with duplicate
			// resolved ids in `items`, or selected ids no longer present in `items`.
			const allSelected =
				selectableItemIds.length > 0
				&& selectableItemIds.every((id) => prev.has(id));

			if (allSelected) return new Set();

			return new Set(selectableItemIds);
		});
	}, [selectableItemIds]);

	const invertSelection = useCallback(() => {
		setSelectedIdsSet((prev) => {
			const newlySelected = selectableItemIds.filter((id) => !prev.has(id));

			return new Set(newlySelected);
		});
	}, [selectableItemIds]);

	const selectMultiple = useCallback(
		(newItems: readonly TId[] | readonly T[]) => {
			const safeItems = Array.isArray(newItems) ? newItems : [];

			setSelectedIdsSet((prev) => {
				const newSet = new Set(prev);

				for (const item of safeItems) {
					const id = resolveSelectionId<T, TId>(item, field);

					if (!(isDisabled?.(id) ?? false)) newSet.add(id);
				}

				return newSet;
			});
		},
		[field, isDisabled],
	);

	const deselectMultiple = useCallback(
		(itemsToRemove: readonly TId[] | readonly T[]) => {
			const safeItems = Array.isArray(itemsToRemove) ? itemsToRemove : [];

			setSelectedIdsSet((prev) => {
				const newSet = new Set(prev);

				for (const item of safeItems) {
					newSet.delete(resolveSelectionId<T, TId>(item, field));
				}

				return newSet;
			});
		},
		[field],
	);

	const retainOnly = useCallback(
		(itemsToRetain: readonly TId[] | readonly T[]) => {
			const safeItems = Array.isArray(itemsToRetain) ? itemsToRetain : [];
			const retainIds = new Set(
				safeItems.map((item) => resolveSelectionId<T, TId>(item, field)),
			);

			setSelectedIdsSet((prev) => {
				const newSet = new Set<TId>();

				prev.forEach((id) => {
					if (retainIds.has(id)) newSet.add(id);
				});

				return newSet;
			});
		},
		[field],
	);

	return {
		selectedIds,
		selectedCount: selectedIdsSet.size,
		selectedItems,
		isEmpty: selectedIdsSet.size === 0,
		isAllSelected,
		isPartiallySelected,
		select,
		deselect,
		toggle,
		isSelected,
		reset,
		replaceSelection,
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
