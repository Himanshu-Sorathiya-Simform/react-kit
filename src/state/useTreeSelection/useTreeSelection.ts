import { useCallback, useMemo, useState } from "react";
import type { SelectionId } from "../../shared/selectionShared/types.ts";
import {
	computeBatchToggle,
	computeFullSelectionState,
	computeIncrementalToggle,
	flattenForest,
	isNodeSelectable,
	resolveTreeId,
} from "./core.ts";
import type {
	FlattenedForest,
	TreeNodeState,
	UseTreeSelectionOptions,
} from "./types.ts";

interface UseTreeSelectionReturn<T, TId extends SelectionId> {
	/**
	 * Every fully-selected node's id, in forest (DFS pre-order) order.
	 * @remarks Includes branch ids too, unless `leafOnly` is set. See {@link UseTreeSelectionOptions.leafOnly}.
	 */
	selectedIds: readonly TId[];

	/** Just the leaf ids among the current selection, regardless of `leafOnly`. */
	selectedLeafIds: readonly TId[];

	/** Every node currently in a partial (some-but-not-all-descendants-selected) state. */
	indeterminateIds: readonly TId[];

	/** The item objects corresponding to {@link UseTreeSelectionReturn.selectedIds}. */
	selectedItems: readonly T[];

	/** `selectedIds.length`. */
	selectedCount: number;

	/** Whether nothing at all is selected (not even indeterminate). */
	isEmpty: boolean;

	/** Whether every selectable root (and by construction, everything under it) is selected. */
	isAllSelected: boolean;

	/** Whether some, but not all, of the forest is selected or indeterminate. */
	isPartiallySelected: boolean;

	/**
	 * The full tri-state read for a node — the primitive the rest of the boolean
	 * getters below are built from.
	 * @param item - A raw id, or a full item.
	 */
	getNodeState: (item: TId | T) => TreeNodeState;

	/** `getNodeState(item) === "selected"`. */
	isSelected: (item: TId | T) => boolean;

	/** `getNodeState(item) === "indeterminate"`. */
	isIndeterminate: (item: TId | T) => boolean;

	/**
	 * Selects `item`, cascading per the `cascade` option.
	 * @remarks No-ops if `item` itself resolves to a disabled id.
	 */
	select: (item: TId | T) => void;

	/** Deselects `item`, cascading per the `cascade` option. Always allowed, even for disabled ids. */
	deselect: (item: TId | T) => void;

	/**
	 * Selects `item` if not selected, deselects it if selected, cascading per the `cascade` option.
	 * @remarks The select-direction is blocked for disabled ids; the deselect-direction never is.
	 */
	toggle: (item: TId | T) => void;

	/** Restores the selection to the current `defaultSelectedIds` (normalized), or empty if none was given. */
	reset: () => void;

	/** Replaces the entire selection with exactly these ids/items (normalized — always internally consistent afterward). */
	replaceSelection: (newSelectedItems: readonly TId[] | readonly T[]) => void;

	/** Selects every selectable node in the forest. */
	selectAll: () => void;

	/** Clears the entire selection. */
	deselectAll: () => void;

	/** If everything selectable is currently selected, clears the selection; otherwise selects everything selectable. */
	toggleAll: () => void;

	/**
	 * Selects multiple ids/items at once, cascading each per the `cascade` option.
	 *
	 * @remarks
	 * More efficient than calling {@link UseTreeSelectionReturn.select} in a loop:
	 * shared ancestors of multiple targets are only recomputed once each, not once
	 * per target that shares them.
	 */
	selectMultiple: (newItems: readonly TId[] | readonly T[]) => void;

	/** Deselects multiple ids/items at once, cascading each per the `cascade` option. Always allowed, even for disabled ids. */
	deselectMultiple: (itemsToRemove: readonly TId[] | readonly T[]) => void;

	/**
	 * Keeps only the ids/items in `itemsToRetain` that are already selected (an
	 * intersection); never adds anything new. The result is re-normalized, so
	 * ancestor indeterminate state stays correct after the shrink.
	 */
	retainOnly: (itemsToRetain: readonly TId[] | readonly T[]) => void;

	/**
	 * Inverts the selection at the leaf level: every currently-unselected
	 * selectable leaf becomes selected, every currently-selected one becomes
	 * unselected. Branch/indeterminate state is re-derived from the result.
	 * @remarks A disabled leaf that was selected before this call does not survive
	 * it — like `useMultipleSelection`'s `invertSelection`, this is a full replace,
	 * not a merge.
	 */
	invertSelection: () => void;

	/** The id of `item`'s direct parent, or `undefined` if it's a root. */
	getParentId: (item: TId | T) => TId | undefined;

	/** Every ancestor id of `item`, nearest first, root last. Empty if `item` is a root. */
	getAncestorIds: (item: TId | T) => readonly TId[];

	/** Every descendant id of `item`. Empty if `item` is a leaf. */
	getDescendantIds: (item: TId | T) => readonly TId[];
}

/**
 * Manages hierarchical (tree/forest) selection state — checkbox trees, nested
 * category pickers, permission trees, file explorers.
 *
 * @remarks
 * - Uncontrolled only for now, SSR-safe (no DOM access), all callbacks manually
 *   memoized — same guarantees as the other selection hooks in this library.
 * - Expand/collapse state is explicitly **not** managed here — it's an orthogonal
 *   view concern, not a selection concern (this hook only ever reads the full
 *   `children` structure, regardless of what's currently expanded in the UI).
 * - **Performance**: a single `select`/`deselect`/`toggle` call is
 *   O(affected subtree) for the cascade-down step plus O(depth × branching factor)
 *   for the cascade-up step — it never re-walks the whole tree. Only whole-forest
 *   operations (`selectAll`, `toggleAll`, `reset`, `replaceSelection`, and the
 *   initial mount) do a full O(n) pass, which is the right complexity for
 *   something that touches every node anyway. Verified independent of selection
 *   order (a known bug class in at least one production tree-selection library
 *   is indeterminate state differing based on the order nodes were selected in).
 * - If `items` (the tree **structure**) changes after mount — nodes added, removed,
 *   or moved — the existing selection/indeterminate state is **not** automatically
 *   re-normalized against the new shape (to avoid surprise O(n) work on every data
 *   refresh). It stays correct for anything the change didn't touch, but the newly
 *   changed area may need an explicit `reset()` or `replaceSelection()` to
 *   guarantee full consistency again.
 *
 * @typeParam T - The tree node shape.
 * @typeParam TId - The id type. Defaults to `SelectionId`.
 * @param options - See {@link UseTreeSelectionOptions}.
 * @returns The current selection state and the actions to mutate it. See {@link UseTreeSelectionReturn}.
 *
 * @example
 * ```tsx
 * interface Category { id: string; name: string; children?: Category[] }
 *
 * const { getNodeState, toggle, isAllSelected, toggleAll } = useTreeSelection<Category, string>({
 *   items: categoryTree,
 *   field: "id",
 *   childrenField: "children",
 * });
 * ```
 */
function useTreeSelection<T, TId extends SelectionId = SelectionId>(
	options: UseTreeSelectionOptions<T, TId>,
): UseTreeSelectionReturn<T, TId> {
	const {
		items: rawItems,
		field,
		childrenField,
		isDisabled,
		leafOnly = false,
	} = options;

	// Defensive guard against non-array input from an untyped/misbehaving caller
	// (plain JS consumer, bad cast, etc.) - never trust the declared type alone.
	const items = useMemo(
		() => (Array.isArray(rawItems) ? rawItems : ([] as readonly T[])),
		[rawItems],
	);

	// Same defensive guard as `items` above.
	const defaultSelectedIds = useMemo(
		() =>
			Array.isArray(options.defaultSelectedIds) ?
				options.defaultSelectedIds
			:	([] as readonly TId[]),
		[options.defaultSelectedIds],
	);

	// Both cascade directions default to true - only opt out explicitly.
	const cascadeDown = options.cascade?.down ?? true;
	const cascadeUp = options.cascade?.up ?? true;

	// The one precomputed structure everything below is built on: a DFS-ordered
	// flat list of every node plus O(1) parent/children lookup maps. This only
	// depends on the tree's *shape* (items/field/childrenField), so it's stable
	// across renders where only the *selection* changes, not the tree itself.
	const forest: FlattenedForest<T, TId> = useMemo(
		() => flattenForest<T, TId>(items, field, childrenField),
		[items, field, childrenField],
	);

	// Lazy initializer - runs once, on mount only. Deliberately does NOT just
	// trust `defaultSelectedIds` as already cascade-consistent (e.g. the caller
	// might pass only a leaf, without marking its ancestors indeterminate) - it's
	// run through the same full bottom-up recompute used by reset/selectAll/etc,
	// so the selection is guaranteed internally consistent from the first render.
	const [state, setState] = useState<{
		selectedIds: Set<TId>;
		indeterminateIds: Set<TId>;
	}>(() =>
		computeFullSelectionState(
			forest,
			new Set(defaultSelectedIds),
			isDisabled,
			cascadeUp,
		),
	);

	// A node with no children (or an empty children array) is a leaf.
	const isLeafId = useCallback(
		(id: TId) => {
			const childIds = forest.childIdsByParentId.get(id);
			return !childIds || childIds.length === 0;
		},
		[forest],
	);

	// The *reported* selection - not necessarily identical to the raw internal
	// `state.selectedIds`. When `leafOnly` is set, branch ids are filtered out
	// here even though they're still tracked internally (so cascading and
	// `getNodeState` for branches keep working normally either way - `leafOnly`
	// only changes what this array reports, not how selection actually behaves).
	// Order follows the forest's DFS order, not Set insertion order.
	const selectedIds = useMemo(() => {
		const ids: TId[] = [];

		for (const entry of forest.entries) {
			if (!state.selectedIds.has(entry.id)) continue;

			if (leafOnly && !isLeafId(entry.id)) continue;

			ids.push(entry.id);
		}

		return ids;
	}, [forest, state.selectedIds, leafOnly, isLeafId]);

	// Leaves only, regardless of `leafOnly` - useful when you want "the real
	// selected resources" even while also selecting/rendering at any level.
	const selectedLeafIds = useMemo(() => {
		const ids: TId[] = [];

		for (const entry of forest.entries) {
			if (state.selectedIds.has(entry.id) && isLeafId(entry.id))
				ids.push(entry.id);
		}

		return ids;
	}, [forest, state.selectedIds, isLeafId]);

	const indeterminateIds = useMemo(() => {
		const ids: TId[] = [];

		for (const entry of forest.entries) {
			if (state.indeterminateIds.has(entry.id)) ids.push(entry.id);
		}

		return ids;
	}, [forest, state.indeterminateIds]);

	// Derived from the already-`leafOnly`-filtered `selectedIds`, not the raw
	// internal Set, so `selectedItems` always matches what `selectedIds` reports.
	const selectedItems = useMemo(() => {
		const idSet = new Set(selectedIds);

		return forest.entries
			.filter((entry) => idSet.has(entry.id))
			.map((entry) => entry.item);
	}, [forest, selectedIds]);

	// Top-level nodes are keyed under `undefined` in the parent map.
	const rootIds = useMemo(
		() => forest.childIdsByParentId.get(undefined) ?? [],
		[forest],
	);

	// Only the ROOTS need checking here, not every node: a root is only ever
	// marked "selected" once its entire subtree is uniformly selected (that's
	// how cascade-up derives it), so "every selectable root is selected" already
	// implies the whole forest is - no need to walk deeper than the top level.
	const isAllSelected = useMemo(() => {
		const selectableRootIds = rootIds.filter((id) =>
			isNodeSelectable(id, isDisabled),
		);

		return (
			selectableRootIds.length > 0
			&& selectableRootIds.every((id) => state.selectedIds.has(id))
		);
	}, [rootIds, isDisabled, state.selectedIds]);

	// Mutually exclusive with isAllSelected: "partially" means some root is
	// selected or indeterminate, but not every root is fully selected.
	const isPartiallySelected = useMemo(() => {
		if (isAllSelected) return false;

		return rootIds.some(
			(id) => state.selectedIds.has(id) || state.indeterminateIds.has(id),
		);
	}, [isAllSelected, rootIds, state.selectedIds, state.indeterminateIds]);

	// The primitive every other read (isSelected/isIndeterminate) is built from -
	// a plain O(1) check against the two internal Sets, checked in priority order
	// (a node is never in both, but selected is checked first regardless).
	const getNodeState = useCallback(
		(item: TId | T): TreeNodeState => {
			const id = resolveTreeId<T, TId>(item, field);

			if (state.selectedIds.has(id)) return "selected";

			if (state.indeterminateIds.has(id)) return "indeterminate";

			return "unselected";
		},
		[state, field],
	);

	const isSelected = useCallback(
		(item: TId | T) => getNodeState(item) === "selected",
		[getNodeState],
	);
	const isIndeterminate = useCallback(
		(item: TId | T) => getNodeState(item) === "indeterminate",
		[getNodeState],
	);

	const select = useCallback(
		(item: TId | T) => {
			const id = resolveTreeId<T, TId>(item, field);

			// Checked *before* setState, not inside it: unlike `toggle` below, this
			// guard doesn't depend on current selection state, so there's no need
			// to pay for entering the updater at all when it's just going to no-op.
			if (isDisabled?.(id)) return;

			setState((prev) =>
				computeIncrementalToggle(
					forest,
					prev.selectedIds,
					prev.indeterminateIds,
					id,
					true,
					isDisabled,
					cascadeDown,
					cascadeUp,
				),
			);
		},
		[field, forest, isDisabled, cascadeDown, cascadeUp],
	);

	const deselect = useCallback(
		(item: TId | T) => {
			const id = resolveTreeId<T, TId>(item, field);

			// No isDisabled guard at all: removal is always allowed, even for a
			// disabled node, even via a cascading deselect from an ancestor.
			setState((prev) =>
				computeIncrementalToggle(
					forest,
					prev.selectedIds,
					prev.indeterminateIds,
					id,
					false,
					isDisabled,
					cascadeDown,
					cascadeUp,
				),
			);
		},
		[field, forest, isDisabled, cascadeDown, cascadeUp],
	);

	const toggle = useCallback(
		(item: TId | T) => {
			const id = resolveTreeId<T, TId>(item, field);

			setState((prev) => {
				// Must read "is it currently selected" from `prev` (the functional
				// updater's argument), not from the `state` closed over at render
				// time - otherwise rapid/batched toggles could act on a stale value.
				const isCurrentlySelected = prev.selectedIds.has(id);

				// Asymmetric guard: only the direction that would ADD to the
				// selection is blocked for a disabled node. Toggling a
				// disabled-but-already-selected node OFF is still allowed.
				if (!isCurrentlySelected && isDisabled?.(id)) return prev;

				return computeIncrementalToggle(
					forest,
					prev.selectedIds,
					prev.indeterminateIds,
					id,
					!isCurrentlySelected,
					isDisabled,
					cascadeDown,
					cascadeUp,
				);
			});
		},
		[field, forest, isDisabled, cascadeDown, cascadeUp],
	);

	// Doesn't just restore the raw `defaultSelectedIds` Set as-is - re-derives
	// consistent cascade/indeterminate state from it, same as the initial mount.
	const reset = useCallback(() => {
		setState(
			computeFullSelectionState(
				forest,
				new Set(defaultSelectedIds),
				isDisabled,
				cascadeUp,
			),
		);
	}, [forest, defaultSelectedIds, isDisabled, cascadeUp]);

	// Also a full re-normalize, not a raw Set swap - a caller-supplied list of
	// ids isn't trusted to already be cascade-consistent either.
	const replaceSelection = useCallback(
		(newSelectedItems: readonly TId[] | readonly T[]) => {
			const safeItems =
				Array.isArray(newSelectedItems) ? newSelectedItems : [];
			const ids = safeItems.map((item) => resolveTreeId<T, TId>(item, field));

			setState(
				computeFullSelectionState(
					forest,
					new Set(ids),
					isDisabled,
					cascadeUp,
				),
			);
		},
		[field, forest, isDisabled, cascadeUp],
	);

	// Every node (branches included) is passed as the "ground truth" set, but
	// computeFullSelectionState only actually consults leaf-level membership
	// when deriving each branch's state - so this is just the simplest way to
	// say "everything selectable should end up selected," not special-cased.
	const selectAll = useCallback(() => {
		const allIds = forest.entries.map((entry) => entry.id);

		setState(
			computeFullSelectionState(
				forest,
				new Set(allIds),
				isDisabled,
				cascadeUp,
			),
		);
	}, [forest, isDisabled, cascadeUp]);

	// Bails out to the *same* prev object (not just an equal-looking new one) if
	// there's nothing to clear, so React can skip the re-render entirely.
	const deselectAll = useCallback(() => {
		setState((prev) =>
			prev.selectedIds.size === 0 && prev.indeterminateIds.size === 0 ?
				prev
			:	{ selectedIds: new Set<TId>(), indeterminateIds: new Set<TId>() },
		);
	}, []);

	const toggleAll = useCallback(() => {
		setState((prev) => {
			const selectableRootIds = rootIds.filter((id) =>
				isNodeSelectable(id, isDisabled),
			);
			// Membership-based (checks every selectable root is actually present
			// in the selection), not a size comparison - a size check alone would
			// misfire if the tree has duplicate ids or stale selected ids that no
			// longer correspond to a current root.
			const allSelected =
				selectableRootIds.length > 0
				&& selectableRootIds.every((id) => prev.selectedIds.has(id));

			if (allSelected)
				return {
					selectedIds: new Set<TId>(),
					indeterminateIds: new Set<TId>(),
				};

			const allIds = forest.entries.map((entry) => entry.id);

			return computeFullSelectionState(
				forest,
				new Set(allIds),
				isDisabled,
				cascadeUp,
			);
		});
	}, [rootIds, forest, isDisabled, cascadeUp]);

	// Uses the batch algorithm rather than looping `select` per item: when
	// several targets share ancestors, each shared ancestor is only recomputed
	// once here, instead of once per target that happens to sit under it.
	const selectMultiple = useCallback(
		(newItems: readonly TId[] | readonly T[]) => {
			const safeItems = Array.isArray(newItems) ? newItems : [];
			const ids = safeItems.map((item) => resolveTreeId<T, TId>(item, field));

			setState((prev) =>
				computeBatchToggle(
					forest,
					prev.selectedIds,
					prev.indeterminateIds,
					ids,
					true,
					isDisabled,
					cascadeDown,
					cascadeUp,
				),
			);
		},
		[field, forest, isDisabled, cascadeDown, cascadeUp],
	);

	// Same batching benefit as selectMultiple, in the remove direction. No
	// isDisabled filtering needed - removal is always allowed regardless.
	const deselectMultiple = useCallback(
		(itemsToRemove: readonly TId[] | readonly T[]) => {
			const safeItems = Array.isArray(itemsToRemove) ? itemsToRemove : [];
			const ids = safeItems.map((item) => resolveTreeId<T, TId>(item, field));

			setState((prev) =>
				computeBatchToggle(
					forest,
					prev.selectedIds,
					prev.indeterminateIds,
					ids,
					false,
					isDisabled,
					cascadeDown,
					cascadeUp,
				),
			);
		},
		[field, forest, isDisabled, cascadeDown, cascadeUp],
	);

	const retainOnly = useCallback(
		(itemsToRetain: readonly TId[] | readonly T[]) => {
			const safeItems = Array.isArray(itemsToRetain) ? itemsToRetain : [];
			const retainIds = new Set(
				safeItems.map((item) => resolveTreeId<T, TId>(item, field)),
			);

			setState((prev) => {
				// Pure intersection of "currently selected" and "should be
				// retained" - can only shrink the selection, never add to it, so
				// there's no isDisabled filtering to do here (nothing new is
				// being introduced). The result still goes through a full
				// recompute so ancestor indeterminate state reflects the shrink.
				const rawGroundTruth = new Set<TId>();

				prev.selectedIds.forEach((id) => {
					if (retainIds.has(id)) rawGroundTruth.add(id);
				});

				return computeFullSelectionState(
					forest,
					rawGroundTruth,
					isDisabled,
					cascadeUp,
				);
			});
		},
		[field, forest, isDisabled, cascadeUp],
	);

	const invertSelection = useCallback(() => {
		setState((prev) => {
			// Inversion happens at the LEAF level only - leaves are the "real"
			// ground truth; branch state is always re-derived from them, never
			// inverted directly. A disabled leaf is skipped entirely here (not
			// carried over), so a disabled-but-previously-selected leaf does not
			// survive this call - this is a full replace, not a merge, same as
			// `useMultipleSelection`'s `invertSelection`.
			const rawGroundTruth = new Set<TId>();

			for (const entry of forest.entries) {
				const childIds = forest.childIdsByParentId.get(entry.id);
				const isLeafEntry = !childIds || childIds.length === 0;

				if (!isLeafEntry) continue;

				if (!isNodeSelectable(entry.id, isDisabled)) continue;

				if (!prev.selectedIds.has(entry.id)) rawGroundTruth.add(entry.id);
			}
			return computeFullSelectionState(
				forest,
				rawGroundTruth,
				isDisabled,
				cascadeUp,
			);
		});
	}, [forest, isDisabled, cascadeUp]);

	const getParentId = useCallback(
		(item: TId | T): TId | undefined => {
			const id = resolveTreeId<T, TId>(item, field);

			return forest.entryById.get(id)?.parentId;
		},
		[forest, field],
	);

	// Walks the parent chain upward one link at a time until a root (parentId
	// === undefined) is reached. O(depth), thanks to the precomputed parent map.
	const getAncestorIds = useCallback(
		(item: TId | T): readonly TId[] => {
			const id = resolveTreeId<T, TId>(item, field);
			const result: TId[] = [];
			let currentId = forest.entryById.get(id)?.parentId;

			while (currentId !== undefined) {
				result.push(currentId);
				currentId = forest.entryById.get(currentId)?.parentId;
			}

			return result;
		},
		[forest, field],
	);

	// Plain stack-based DFS down through the children map - order isn't
	// meaningful here, so no need for anything fancier than a simple traversal.
	const getDescendantIds = useCallback(
		(item: TId | T): readonly TId[] => {
			const id = resolveTreeId<T, TId>(item, field);
			const result: TId[] = [];
			const stack = [...(forest.childIdsByParentId.get(id) ?? [])];

			while (stack.length > 0) {
				const currentId = stack.pop() as TId;

				result.push(currentId);

				const childIds = forest.childIdsByParentId.get(currentId);

				if (childIds) stack.push(...childIds);
			}
			return result;
		},
		[forest, field],
	);

	return {
		selectedIds,
		selectedLeafIds,
		indeterminateIds,
		selectedItems,
		selectedCount: selectedIds.length,
		isEmpty: state.selectedIds.size === 0 && state.indeterminateIds.size === 0,
		isAllSelected,
		isPartiallySelected,
		getNodeState,
		isSelected,
		isIndeterminate,
		select,
		deselect,
		toggle,
		reset,
		replaceSelection,
		selectAll,
		deselectAll,
		toggleAll,
		selectMultiple,
		deselectMultiple,
		retainOnly,
		invertSelection,
		getParentId,
		getAncestorIds,
		getDescendantIds,
	};
}

export { type UseTreeSelectionReturn, useTreeSelection };
