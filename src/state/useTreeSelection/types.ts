import type { SelectionId } from "../../shared/selectionShared/types.ts";

/**
 * Restricts `field` to a **top-level** key of `T` whose value is assignable to `TId`.
 *
 * @remarks
 * Deliberately not the recursive dot-path style used by `useMultipleSelection`'s
 * `SelectionIdPath<T, TId>`. Tree nodes are self-referential (a `children` property
 * whose value is `T[]`, pointing back to `T`), and running the recursive `Path<T>`
 * machinery over a self-referential type produces a genuine TypeScript circular-reference
 * error. A tree node's id is virtually always a direct top-level property anyway — a
 * dot-path id nested inside a tree node would be an unusual shape — so this simpler,
 * non-recursive key filter is both the fix and the more correct constraint. The function
 * form below remains available for anything this doesn't cover.
 */
type FieldKey<T, TId extends SelectionId> = {
	[K in keyof T]: T[K] extends TId ? K : never;
}[keyof T]
	& string;

/** Restricts `childrenField` to a top-level key of `T` whose value is `T[]` (or `undefined`). */
type ChildrenKey<T> = {
	[K in keyof T]: T[K] extends readonly T[] | undefined ? K : never;
}[keyof T]
	& string;

/** Either a type-checked property key, or a function, for extracting a node's id. */
type FieldAccessor<T, TId extends SelectionId> =
	| FieldKey<T, TId>
	| ((item: T) => TId);

/** Either a type-checked property key, or a function, for extracting a node's children. */
type ChildrenAccessor<T> = ChildrenKey<T> | ((item: T) => readonly T[] | undefined);

/** The three states a tree node can be in with respect to the current selection. */
type TreeNodeState = "selected" | "indeterminate" | "unselected";

/** One flattened tree entry, produced by {@link flattenForest}. */
interface FlatTreeEntry<T, TId extends SelectionId> {
	item: T;
	id: TId;
	parentId: TId | undefined;
	depth: number;
}

/** The precomputed structures every tree-selection operation is built on. */
interface FlattenedForest<T, TId extends SelectionId> {
	/** Every node in the forest, in DFS pre-order. */
	entries: readonly FlatTreeEntry<T, TId>[];
	/** O(1) lookup from id to its flattened entry. */
	entryById: ReadonlyMap<TId, FlatTreeEntry<T, TId>>;
	/** O(1) lookup from a node's id to its direct children's ids. Roots are keyed under `undefined`. */
	childIdsByParentId: ReadonlyMap<TId | undefined, readonly TId[]>;
}

interface UseTreeSelectionOptions<T, TId extends SelectionId> {
	/** The forest — an array of root nodes. Each node's children are found via `childrenField`. */
	items: readonly T[];

	/** How to extract a node's id. A type-checked top-level key, or a function. */
	field: FieldAccessor<T, TId>;

	/** How to extract a node's children. A type-checked top-level key, or a function. */
	childrenField: ChildrenAccessor<T>;

	/**
	 * The ids selected on mount, and what {@link UseTreeSelectionReturn.reset} returns to.
	 *
	 * @remarks
	 * Not trusted as already cascade-consistent — always run through the same
	 * full bottom-up normalization used by `reset`/`selectAll`/etc, so passing
	 * e.g. only a leaf (without its ancestors) still produces correct indeterminate
	 * ancestor state from the start.
	 */
	defaultSelectedIds?: readonly TId[];

	/**
	 * Predicate marking certain ids as non-selectable.
	 *
	 * @remarks
	 * A disabled node is skipped during cascade (never force-toggled) and excluded
	 * from every "are all children selected" computation, but disabling a node does
	 * **not** auto-disable its descendants, and does not retroactively clear it if
	 * it was already selected before becoming disabled — same philosophy as the
	 * flat selection hooks.
	 */
	isDisabled?: (id: TId) => boolean;

	/**
	 * Independently controls whether selecting a node propagates to its descendants
	 * (`down`) and/or its ancestors (`up`). Both default to `true`.
	 *
	 * @remarks
	 * `{ down: false, up: false }` degenerates into flat, non-hierarchical
	 * selection over tree-rendered nodes (no relationship between a node's
	 * selection and its parent/children) — the same shape react-arborist/MUI's
	 * default tree multi-select uses, as opposed to checkbox-tree cascading.
	 */
	cascade?: {
		down?: boolean;
		up?: boolean;
	};

	/**
	 * When `true`, {@link UseTreeSelectionReturn.selectedIds} and
	 * {@link UseTreeSelectionReturn.selectedItems} only include leaf nodes,
	 * even if a fully-covered branch is internally tracked as selected.
	 *
	 * @remarks
	 * This does not change `select`/`toggle`/cascade behavior at all — you can
	 * still call `select` on a branch and it cascades normally, and
	 * {@link UseTreeSelectionReturn.getNodeState} still reports branches correctly
	 * as `"selected"`/`"indeterminate"` for display regardless of this option. It
	 * only changes what the flat `selectedIds`/`selectedItems` arrays report — useful
	 * when branches are just a UI grouping and the "real" selected resources are
	 * always the leaves (e.g. sending a set of leaf resource ids to a backend).
	 * {@link UseTreeSelectionReturn.selectedLeafIds} gives you the leaf subset
	 * regardless of this option, if you want both views at once.
	 */
	leafOnly?: boolean;
}

export {
	type ChildrenAccessor,
	type ChildrenKey,
	type FieldAccessor,
	type FieldKey,
	type FlattenedForest,
	type FlatTreeEntry,
	type SelectionId,
	type TreeNodeState,
	type UseTreeSelectionOptions,
};
