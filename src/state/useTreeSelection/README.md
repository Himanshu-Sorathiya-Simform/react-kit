# useTreeSelection

A strictly type-safe React hook for managing hierarchical selection state — checkbox trees, nested category pickers, permission trees, and file explorers, with correct parent/child cascading and indeterminate state built in.

---

## Motivation (Why this hook?)

Flat selection (`useMultipleSelection`) assumes every item stands alone. Trees don't work that way — selecting a folder should usually select what's inside it, and a folder with only *some* of its contents selected needs to show a distinct "partially selected" state, not just on or off. That relationship between a node and its ancestors/descendants is genuinely easy to get wrong by hand: it's common for hand-rolled implementations to end up with a selection state that depends on the *order* items were clicked in, rather than being consistent no matter how you got there — the same underlying data producing a different-looking tree depending on click history is a real, reported bug class in more than one production tree component.

`useTreeSelection` handles this once, correctly:

- **Cascading, both directions, independently configurable.** Selecting a parent can select its descendants (`cascade.down`), and selecting every child of a parent can mark that parent selected too (`cascade.up`). Each direction can be turned off independently — turn both off and you get flat, non-hierarchical multi-select over a tree-shaped list instead, no separate hook required.
- **Correct indeterminate state**, computed consistently regardless of the order nodes were selected in.
- **Type-safe by design**, generic over both your node type `T` and your id type `TId`, with `field`/`childrenField` checked against your node's actual shape at compile time.
- **Efficient even on large trees.** A single click doesn't re-scan the whole tree — only the part of it that could actually have changed.
- **Disabled nodes**, cleanly excluded from cascading without needing special-case logic in your click handlers.

---

## Import

```tsx
// Preferred
import { useTreeSelection, type UseTreeSelectionReturn } from "@himanshu-sorathiya/react-kit/state";
// Or
import { useTreeSelection, type UseTreeSelectionReturn } from "@himanshu-sorathiya/react-kit";
```

---

## Basic Usage

```tsx
import { useTreeSelection } from "@himanshu-sorathiya/react-kit/state";

interface Category {
	id: string;
	name: string;
	children?: Category[];
}

const categoryTree: Category[] = [
	{
		id: "electronics",
		name: "Electronics",
		children: [
			{ id: "phones", name: "Phones" },
			{ id: "laptops", name: "Laptops" },
		],
	},
	{ id: "books", name: "Books" },
];

function CategoryPicker() {
	const { getNodeState, toggle } = useTreeSelection<Category, string>({
		items: categoryTree,
		field: "id",
		childrenField: "children",
	});

	function renderNode(node: Category) {
		const state = getNodeState(node);
		return (
			<li key={node.id}>
				<label>
					<input
						type="checkbox"
						checked={state === "selected"}
						ref={(el) => el && (el.indeterminate = state === "indeterminate")}
						onChange={() => toggle(node)}
					/>
					{node.name}
				</label>
				{node.children && <ul>{node.children.map(renderNode)}</ul>}
			</li>
		);
	}

	return <ul>{categoryTree.map(renderNode)}</ul>;
}
```

---

## API Reference

### Parameters

`useTreeSelection` accepts a single options object:

| Parameter            | Type                                        | Required | Description                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`               | `readonly T[]`                                 | **Yes**  | The forest — an array of root nodes. Not a "list of everything," just the top level; each node's children are found via `childrenField`.                                              |
| `field`               | A checked key of `T`, or a `(item: T) => TId` | **Yes**  | How to get a node's id. See [Gotchas](#gotchas--edge-cases) for how this differs from `useMultipleSelection`'s `field`.                                                                |
| `childrenField`       | A checked key of `T`, or `(item: T) => T[] \| undefined` | **Yes** | How to get a node's children.                                                                                                                                                            |
| `defaultSelectedIds`  | `readonly TId[]`                               | No       | The ids selected when the hook first mounts, and what `reset()` restores the selection to. You don't need to include ancestor ids yourself — they're derived automatically.            |
| `isDisabled`          | `(id: TId) => boolean`                         | No       | Marks certain nodes as non-selectable. Skipped during cascade, and excluded from every "are all children selected" check, without needing to auto-disable its descendants.             |
| `cascade`              | `{ down?: boolean; up?: boolean }`             | No       | Independently controls whether selection propagates to descendants (`down`) and/or ancestors (`up`). Both default to `true`.                                                           |
| `leafOnly`             | `boolean`                                      | No       | When `true`, `selectedIds`/`selectedItems` only report leaf nodes. Doesn't change how `select`/`toggle` behave — see [Gotchas](#gotchas--edge-cases).                                    |

> `TId` defaults to `SelectionId` (`string | number`).

### Return Values

| Property / Method                      | Type                                              | Description                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `selectedIds`                           | `readonly TId[]`                                    | Every fully-selected node's id (branches included, unless `leafOnly`), in top-to-bottom tree order.                            |
| `selectedLeafIds`                       | `readonly TId[]`                                    | Just the leaf ids among the current selection, regardless of `leafOnly`.                                                       |
| `indeterminateIds`                      | `readonly TId[]`                                    | Every node currently in a partial (some-but-not-all-descendants-selected) state.                                                |
| `selectedItems`                         | `readonly T[]`                                      | The node objects corresponding to `selectedIds`.                                                                                |
| `selectedCount`                         | `number`                                            | `selectedIds.length`.                                                                                                            |
| `isEmpty`                                | `boolean`                                           | `true` when nothing is selected — not even indeterminate.                                                                       |
| `isAllSelected`                         | `boolean`                                           | `true` when every selectable node in the forest is selected.                                                                    |
| `isPartiallySelected`                   | `boolean`                                           | `true` when some, but not all, of the forest is selected or indeterminate.                                                      |
| `getNodeState(item)`                    | `(item: TId \| T) => "selected" \| "indeterminate" \| "unselected"` | The full tri-state read for a node — the primitive the boolean getters below are built from.               |
| `isSelected(item)`                      | `(item: TId \| T) => boolean`                       | `getNodeState(item) === "selected"`.                                                                                             |
| `isIndeterminate(item)`                 | `(item: TId \| T) => boolean`                       | `getNodeState(item) === "indeterminate"`.                                                                                        |
| `select(item)`                          | `(item: TId \| T) => void`                          | Selects a node, cascading per the `cascade` option. No-ops if the node itself is disabled.                                      |
| `deselect(item)`                        | `(item: TId \| T) => void`                          | Deselects a node, cascading per the `cascade` option. Always allowed, even for a disabled node.                                 |
| `toggle(item)`                          | `(item: TId \| T) => void`                          | Selects if unselected, deselects if selected, cascading either way. The select-direction is blocked for a disabled node.       |
| `reset()`                                | `() => void`                                        | Restores the selection to the current `defaultSelectedIds`.                                                                     |
| `replaceSelection(newSelectedItems)`    | `(items: readonly TId[] \| readonly T[]) => void`   | Replaces the entire selection with exactly these ids/items.                                                                     |
| `selectAll()`                            | `() => void`                                        | Selects every selectable node in the forest.                                                                                     |
| `deselectAll()`                          | `() => void`                                        | Clears the entire selection.                                                                                                     |
| `toggleAll()`                            | `() => void`                                        | If everything selectable is selected, clears the selection; otherwise selects everything selectable.                            |
| `selectMultiple(newItems)`              | `(items: readonly TId[] \| readonly T[]) => void`   | Selects multiple nodes at once, cascading each per the `cascade` option.                                                        |
| `deselectMultiple(itemsToRemove)`       | `(items: readonly TId[] \| readonly T[]) => void`   | Deselects multiple nodes at once. Always allowed.                                                                               |
| `retainOnly(itemsToRetain)`             | `(items: readonly TId[] \| readonly T[]) => void`   | Keeps only the given ids/items that are already selected; never adds anything new.                                              |
| `invertSelection()`                      | `() => void`                                        | Inverts the selection at the leaf level: unselected selectable leaves become selected and vice versa.                          |
| `getParentId(item)`                     | `(item: TId \| T) => TId \| undefined`              | The id of a node's direct parent, or `undefined` if it's a root.                                                                 |
| `getAncestorIds(item)`                  | `(item: TId \| T) => readonly TId[]`                | Every ancestor id of a node, nearest first, root last.                                                                          |
| `getDescendantIds(item)`                | `(item: TId \| T) => readonly TId[]`                | Every descendant id of a node.                                                                                                    |

---

## Advanced Usage & Examples

### Disabling Specific Nodes

```tsx
import { useTreeSelection } from "@himanshu-sorathiya/react-kit/state";

interface Permission {
	id: string;
	name: string;
	locked: boolean;
	children?: Permission[];
}

function PermissionTree({ tree }: { tree: Permission[] }) {
	const { getNodeState, toggle } = useTreeSelection<Permission, string>({
		items: tree,
		field: "id",
		childrenField: "children",
		isDisabled: (id) => findById(tree, id)?.locked ?? false,
	});

	// render as in Basic Usage, adding `disabled={findById(tree, node.id)?.locked}`
	// to each checkbox
}
```

### Flat Mode (No Cascading)

Turn both cascade directions off to get tree-shaped rendering with independent, non-hierarchical multi-select — closer to a file explorer's ctrl/shift-click selection than a checkbox tree.

```tsx
const { isSelected, toggle } = useTreeSelection<Category, string>({
	items: categoryTree,
	field: "id",
	childrenField: "children",
	cascade: { down: false, up: false },
});
```

### Leaf-Only Reporting

When branches are just a UI grouping and the ids you actually care about are always the leaves (e.g. sending a set of resource ids to a backend):

```tsx
const { selectedIds, toggle } = useTreeSelection<Category, string>({
	items: categoryTree,
	field: "id",
	childrenField: "children",
	leafOnly: true,
});

// selectedIds only ever contains leaf ids, even if you click a whole branch —
// clicking "Electronics" still cascades and selects "Phones"/"Laptops" as usual,
// it just won't include "electronics" itself in selectedIds.
```

---

## Real-World Use Cases

- Permission trees in an admin panel (grant access to a whole department or individual users)
- File/folder explorers with multi-select
- Nested product category pickers in an e-commerce admin
- Org chart selection for bulk actions (e.g. sending an announcement to a division)
- Comment thread selection (e.g. bulk-moderating a thread and its replies)
- Multi-level navigation menu configuration (choosing which sections/pages are visible)
- Curriculum or course-module selection, where a course contains modules containing lessons
- Tag/category hierarchies with parent/child relationships (e.g. "Sports > Basketball > NBA")

---

## Gotchas & Edge Cases

- **`field`/`childrenField` are top-level only.** Unlike `useMultipleSelection`'s `field`, these don't support dot-notation paths into nested objects — they must be a direct property of your node (or a function). This is a deliberate difference: tree node types are self-referential (a node's `children` property points back to the same type), and that shape doesn't work with the recursive path-checking `useMultipleSelection` uses. If your id or children genuinely live somewhere nested, use the function form: `field: (item) => item.meta.id`.
- **Tree structure changes aren't automatically re-normalized.** If the *shape* of `items` changes after mount — nodes added, removed, or moved — the existing selection isn't automatically recalculated against the new structure, to avoid doing expensive work on every data refresh. It stays correct for anything the change didn't touch, but call `reset()` or `replaceSelection()` after a structural change if you need a guaranteed-consistent state.
- **`leafOnly` only changes what's reported, not how selection behaves.** You can still call `select`/`toggle` on a branch under `leafOnly: true` and it cascades exactly as normal — the option only filters what `selectedIds`/`selectedItems` include in their output. `getNodeState` still reports branches correctly for display regardless of this option.
- **Expand/collapse state isn't managed here.** This hook only concerns itself with selection — which nodes are expanded/collapsed in your UI is a separate, orthogonal piece of state you manage yourself (e.g. with a plain `useState<Set<string>>`).
- **`isDisabled` affects addition, not removal**, same as `useMultipleSelection` — a node selected before it became disabled stays selected until explicitly deselected, whether directly or via a cascading deselect from an ancestor.

---

## See Also

- [useSingleSelection](../useSingleSelection/README.md) — single-item selection state, for radio-button-style "only one at a time" UI.
- [useMultipleSelection](../useMultipleSelection/README.md) — flat multi-item selection state, for lists, tables, and grids without hierarchy.
