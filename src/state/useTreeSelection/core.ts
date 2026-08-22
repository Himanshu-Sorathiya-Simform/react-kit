declare const process: { env: { NODE_ENV?: string } } | undefined;

import type { SelectionId } from "../../shared/selectionShared/types.ts";
import type {
	ChildrenAccessor,
	FieldAccessor,
	FlattenedForest,
	FlatTreeEntry,
	TreeNodeState,
} from "./types.ts";

function resolveTreeItemId<T, TId extends SelectionId>(
	item: T,
	field: FieldAccessor<T, TId>,
): TId {
	let id: TId;
	if (typeof field === "function") {
		id = field(item);
	} else {
		id = item[field as unknown as keyof T] as unknown as TId;
	}

	if (
		typeof process !== "undefined"
		&& process.env?.["NODE_ENV"] !== "production"
	) {
		if (id === undefined || id === null) {
			console.warn(
				"[resolveTreeItemId] Resolved id is",
				id,
				"— this usually means `field` does not point to a valid property on the item.",
			);
			throw new Error(
				`[resolveTreeItemId] Invalid id resolved: ${String(id)}`,
			);
		}
	}

	return id;
}

function resolveTreeItemChildren<T>(
	item: T,
	childrenField: ChildrenAccessor<T>,
): readonly T[] | undefined {
	if (typeof childrenField === "function") return childrenField(item);

	return item[childrenField as unknown as keyof T] as unknown as
		| readonly T[]
		| undefined;
}

/**
 * Flattens a forest (array of root nodes) into a DFS pre-order list plus O(1)
 * parent/children lookup maps — the structures every other function here relies on.
 *
 * @remarks
 * Guards against cyclic data (a node that is its own ancestor): a cycle is broken
 * (the repeated node's subtree is skipped) rather than recursing forever, with a
 * dev-only console warning. Real tree data sourced from an API can be malformed;
 * this keeps a bug in the data from hanging the tab.
 */
function flattenForest<T, TId extends SelectionId>(
	roots: readonly T[],
	field: FieldAccessor<T, TId>,
	childrenField: ChildrenAccessor<T>,
): FlattenedForest<T, TId> {
	const entries: FlatTreeEntry<T, TId>[] = [];
	const entryById = new Map<TId, FlatTreeEntry<T, TId>>();
	const childIdsByParentId = new Map<TId | undefined, TId[]>();

	function visit(
		item: T,
		parentId: TId | undefined,
		depth: number,
		ancestorIds: ReadonlySet<TId>,
	) {
		const id = resolveTreeItemId<T, TId>(item, field);

		if (ancestorIds.has(id)) {
			if (
				typeof process !== "undefined"
				&& process.env?.["NODE_ENV"] !== "production"
			) {
				console.warn(
					"[useTreeSelection] Cycle detected: node",
					id,
					"is its own ancestor. This subtree is being skipped rather than recursed forever.",
				);
				throw new Error(
					`[useTreeSelection] Cycle detected: node ${id} is its own ancestor.`,
				);
			}
			return;
		}

		const entry: FlatTreeEntry<T, TId> = { item, id, parentId, depth };

		entries.push(entry);
		entryById.set(id, entry);

		const existingSiblings = childIdsByParentId.get(parentId);

		if (existingSiblings) existingSiblings.push(id);
		else childIdsByParentId.set(parentId, [id]);

		const children = resolveTreeItemChildren(item, childrenField);

		if (!children || children.length === 0) return;

		const nextAncestorIds = new Set(ancestorIds);
		nextAncestorIds.add(id);

		for (const child of children) visit(child, id, depth + 1, nextAncestorIds);
	}

	for (const root of roots) visit(root, undefined, 0, new Set());

	return { entries, entryById, childIdsByParentId };
}

function isNodeSelectable<TId extends SelectionId>(
	id: TId,
	isDisabled: ((id: TId) => boolean) | undefined,
): boolean {
	return !(isDisabled?.(id) ?? false);
}

/** Resolves an id from either a raw id or a full item — mirrors `resolveSelectionId` for the flat hooks. */
function resolveTreeId<T, TId extends SelectionId>(
	item: TId | T,
	field: FieldAccessor<T, TId>,
): TId {
	if (typeof item === "string" || typeof item === "number") return item as TId;

	return resolveTreeItemId<T, TId>(item as T, field);
}

/**
 * Full bottom-up recompute of every node's selected/indeterminate state, from a
 * raw set of "these ids should be fully selected" ground truth.
 *
 * @remarks
 * O(n) — appropriate for operations that touch the whole forest anyway (initial
 * mount, `selectAll`, `replaceSelection`, `reset`), and also serves as the
 * self-healing normalization step for those: it never trusts the raw input as
 * already being cascade-consistent (e.g. a caller-supplied `defaultSelectedIds`
 * that only lists a leaf, without its ancestors being marked indeterminate) —
 * it always re-derives the correct, consistent state from scratch.
 */
function computeFullSelectionState<T, TId extends SelectionId>(
	forest: FlattenedForest<T, TId>,
	rawSelectedIds: ReadonlySet<TId>,
	isDisabled: ((id: TId) => boolean) | undefined,
	cascadeUp: boolean,
): { selectedIds: Set<TId>; indeterminateIds: Set<TId> } {
	const selectedIds = new Set<TId>();
	const indeterminateIds = new Set<TId>();

	function compute(id: TId): TreeNodeState {
		const childIds = forest.childIdsByParentId.get(id);
		const isLeaf = !childIds || childIds.length === 0;

		if (isLeaf || !cascadeUp) {
			const state: TreeNodeState =
				rawSelectedIds.has(id) ? "selected" : "unselected";

			if (state === "selected") selectedIds.add(id);

			return state;
		}

		const selectableChildIds = childIds.filter((childId) =>
			isNodeSelectable(childId, isDisabled),
		);

		if (selectableChildIds.length === 0) {
			const state: TreeNodeState =
				rawSelectedIds.has(id) ? "selected" : "unselected";

			if (state === "selected") selectedIds.add(id);

			return state;
		}

		let allSelected = true;
		let anySelectedOrIndeterminate = false;
		for (const childId of selectableChildIds) {
			const childState = compute(childId);

			if (childState !== "selected") allSelected = false;

			if (childState !== "unselected") anySelectedOrIndeterminate = true;
		}

		if (allSelected) {
			selectedIds.add(id);

			return "selected";
		}

		if (anySelectedOrIndeterminate) {
			indeterminateIds.add(id);

			return "indeterminate";
		}

		return "unselected";
	}

	const rootIds = forest.childIdsByParentId.get(undefined) ?? [];

	for (const rootId of rootIds) compute(rootId);

	return { selectedIds, indeterminateIds };
}

/**
 * Applies a single select/deselect/toggle to `targetId` and returns the new state.
 *
 * @remarks
 * This is the performance-critical path. It does **not** re-walk the whole tree:
 * - cascade-down touches only `targetId`'s own subtree (unavoidable — that many
 *   nodes' state is genuinely changing) — O(subtree size).
 * - cascade-up walks only the ancestor chain from `targetId`'s parent to the root,
 *   and at each ancestor looks only at that ancestor's *direct* children's
 *   already-known state (an O(1) Set lookup each) rather than re-deriving each
 *   child's state from scratch — O(depth × branching factor), not O(depth × subtree size).
 *
 * This two-part design is what keeps single-node toggles cheap on large trees, and
 * — because it's a pure function of current Set membership rather than "how did we
 * get here" — it's also what keeps the result independent of *which order* sibling
 * nodes were selected in (verified: a known bug class in at least one production
 * tree-selection implementation is indeterminate state coming out differently
 * depending on selection order).
 */
function computeIncrementalToggle<T, TId extends SelectionId>(
	forest: FlattenedForest<T, TId>,
	prevSelectedIds: ReadonlySet<TId>,
	prevIndeterminateIds: ReadonlySet<TId>,
	targetId: TId,
	nextValue: boolean,
	isDisabled: ((id: TId) => boolean) | undefined,
	cascadeDown: boolean,
	cascadeUp: boolean,
): { selectedIds: Set<TId>; indeterminateIds: Set<TId> } {
	const selectedIds = new Set(prevSelectedIds);
	const indeterminateIds = new Set(prevIndeterminateIds);

	// 1. Cascade down (or just the single target, if cascade-down is disabled).
	const subtreeIds: TId[] = [targetId];

	if (cascadeDown) {
		const stack = [targetId];

		while (stack.length > 0) {
			const currentId = stack.pop() as TId;
			const childIds = forest.childIdsByParentId.get(currentId);

			if (!childIds) continue;

			for (const childId of childIds) {
				subtreeIds.push(childId);
				stack.push(childId);
			}
		}
	}

	for (const id of subtreeIds) {
		indeterminateIds.delete(id); // cascade-down always produces a uniform state, never partial

		// The disabled guard only blocks ADDING to the selection, never removing from
		// it - a node that was selected before it became disabled must still be
		// removable via a cascading deselect from an ancestor, same as a direct one.
		if (nextValue && !isNodeSelectable(id, isDisabled)) continue;

		if (nextValue) selectedIds.add(id);
		else selectedIds.delete(id);
	}

	// 2. Cascade up the ancestor chain (if enabled), one level at a time.
	if (cascadeUp) {
		let currentId = forest.entryById.get(targetId)?.parentId;
		while (currentId !== undefined) {
			const childIds = forest.childIdsByParentId.get(currentId) ?? [];
			const selectableChildIds = childIds.filter((childId) =>
				isNodeSelectable(childId, isDisabled),
			);

			if (selectableChildIds.length === 0) {
				currentId = forest.entryById.get(currentId)?.parentId;
				continue;
			}

			let allSelected = true;
			let anySelectedOrIndeterminate = false;
			for (const childId of selectableChildIds) {
				const childSelected = selectedIds.has(childId);
				const childIndeterminate = indeterminateIds.has(childId);

				if (!childSelected) allSelected = false;
				if (childSelected || childIndeterminate)
					anySelectedOrIndeterminate = true;
			}

			if (allSelected) {
				selectedIds.add(currentId);
				indeterminateIds.delete(currentId);
			} else if (anySelectedOrIndeterminate) {
				indeterminateIds.add(currentId);
				selectedIds.delete(currentId);
			} else {
				selectedIds.delete(currentId);
				indeterminateIds.delete(currentId);
			}

			currentId = forest.entryById.get(currentId)?.parentId;
		}
	}

	return { selectedIds, indeterminateIds };
}

/**
 * Applies the same select/deselect to multiple targets at once, more efficiently
 * than calling {@link computeIncrementalToggle} once per target.
 *
 * @remarks
 * Cascade-down still touches exactly the union of the targets' subtrees (unavoidable).
 * The optimization is in cascade-up: rather than walking each target's full ancestor
 * chain independently (which, for targets sharing ancestors, would recompute the same
 * shared ancestor once per target), this collects the union of every affected ancestor
 * once, then resolves them **deepest-first**. Because the full ancestor chain of every
 * target is included, a node's parent is only ever processed after the node itself,
 * so every ancestor is recomputed exactly once, using already-final child state.
 */
function computeBatchToggle<T, TId extends SelectionId>(
	forest: FlattenedForest<T, TId>,
	prevSelectedIds: ReadonlySet<TId>,
	prevIndeterminateIds: ReadonlySet<TId>,
	targetIds: readonly TId[],
	nextValue: boolean,
	isDisabled: ((id: TId) => boolean) | undefined,
	cascadeDown: boolean,
	cascadeUp: boolean,
): { selectedIds: Set<TId>; indeterminateIds: Set<TId> } {
	const selectedIds = new Set(prevSelectedIds);
	const indeterminateIds = new Set(prevIndeterminateIds);
	const affectedAncestorIds = new Set<TId>();

	for (const targetId of targetIds) {
		const subtreeIds: TId[] = [targetId];

		if (cascadeDown) {
			const stack = [targetId];

			while (stack.length > 0) {
				const currentId = stack.pop() as TId;
				const childIds = forest.childIdsByParentId.get(currentId);

				if (!childIds) continue;

				for (const childId of childIds) {
					subtreeIds.push(childId);
					stack.push(childId);
				}
			}
		}

		for (const id of subtreeIds) {
			indeterminateIds.delete(id);

			if (nextValue && !isNodeSelectable(id, isDisabled)) continue;

			if (nextValue) selectedIds.add(id);
			else selectedIds.delete(id);
		}

		if (cascadeUp) {
			let currentId = forest.entryById.get(targetId)?.parentId;

			while (currentId !== undefined) {
				affectedAncestorIds.add(currentId);
				currentId = forest.entryById.get(currentId)?.parentId;
			}
		}
	}

	if (affectedAncestorIds.size > 0) {
		const sortedDeepestFirst = [...affectedAncestorIds].sort(
			(a, b) =>
				(forest.entryById.get(b)?.depth ?? 0)
				- (forest.entryById.get(a)?.depth ?? 0),
		);

		for (const ancestorId of sortedDeepestFirst) {
			const childIds = forest.childIdsByParentId.get(ancestorId) ?? [];
			const selectableChildIds = childIds.filter((childId) =>
				isNodeSelectable(childId, isDisabled),
			);

			if (selectableChildIds.length === 0) continue;

			let allSelected = true;
			let anySelectedOrIndeterminate = false;
			for (const childId of selectableChildIds) {
				const childSelected = selectedIds.has(childId);
				const childIndeterminate = indeterminateIds.has(childId);

				if (!childSelected) allSelected = false;

				if (childSelected || childIndeterminate)
					anySelectedOrIndeterminate = true;
			}

			if (allSelected) {
				selectedIds.add(ancestorId);
				indeterminateIds.delete(ancestorId);
			} else if (anySelectedOrIndeterminate) {
				indeterminateIds.add(ancestorId);
				selectedIds.delete(ancestorId);
			} else {
				selectedIds.delete(ancestorId);
				indeterminateIds.delete(ancestorId);
			}
		}
	}

	return { selectedIds, indeterminateIds };
}

export {
	computeBatchToggle,
	computeFullSelectionState,
	computeIncrementalToggle,
	flattenForest,
	isNodeSelectable,
	resolveTreeId,
	resolveTreeItemChildren,
	resolveTreeItemId,
};
