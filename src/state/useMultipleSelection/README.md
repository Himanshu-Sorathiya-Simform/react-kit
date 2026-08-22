# useMultipleSelection

A strictly type-safe, fully client-side React hook for managing multi-item selection state — built for lists, tables, grids, and any UI where users need to select more than one thing at a time.

---

## Motivation (Why this hook?)

Selection state looks trivial until you actually build it. What starts as a single `useState<Set<string>>` quietly grows into a pile of one-off helper functions: one for toggling a row, one for "select all," one for inverting a selection, one for cleaning up stale ids after a filter or search changes the underlying dataset, one for a "select all" checkbox's indeterminate state. Each of these is easy to get subtly wrong — especially around `Set` immutability, and around bulk operations silently misbehaving once your data has duplicate ids or the selection includes ids that are no longer in the list.

`useMultipleSelection` collapses all of that into a single, predictable API:

- **Encapsulates the hard parts.** Operations like `invertSelection`, `retainOnly`, and `toggleAll` are notoriously fiddly to hand-roll correctly — they all require careful handling of overlap between "already selected" and "candidate" sets, and of what should happen with stale or duplicate ids. This hook implements them once, correctly, so you don't have to.
- **Type-safe by design.** The hook is generic over your item type `T` and your id type `TId`. `selectedItems` comes back fully typed, no `as` casts. When you're working with objects, `field` is checked at compile time against your item's actual shape — pointing it at a property that doesn't exist, or one that isn't a valid id, is a build error instead of a silent `undefined` at runtime.
- **Performant by default.** Selection is stored internally as a `Set`, giving O(1) membership checks for `isSelected`, and every derived value (`selectedItems`, `selectedIds`, `isAllSelected`, etc.) is memoized so it's only recomputed when what it actually depends on changes — not on every render.
- **Works with primitives *and* objects, automatically.** Whether your list is `string[]`, `number[]`, or an array of rich objects, the hook resolves the correct identity for each item — you just tell it which `field` to use for objects, or omit it entirely for primitives.

In short: you get a robust, reusable selection engine instead of a bespoke one you have to maintain per-feature.

---

## Import Syntax

```tsx
// Preferred
import {
	useMultipleSelection,
	type UseMultipleSelectionReturn,
} from "@himanshu-sorathiya/react-kit/state";
// Or
import {
	useMultipleSelection,
	type UseMultipleSelectionReturn,
} from "@himanshu-sorathiya/react-kit";
```

---

## Basic Usage

```tsx
import { useMultipleSelection } from "@himanshu-sorathiya/react-kit/state";

interface Task {
	id: string;
	title: string;
}

const tasks: Task[] = [
	{ id: "t1", title: "Write README" },
	{ id: "t2", title: "Review PR" },
	{ id: "t3", title: "Ship release" },
];

function TaskList() {
	const { selectedCount, isSelected, toggle } = useMultipleSelection<Task>({
		items: tasks,
		field: "id",
	});

	return (
		<div>
			<p>{selectedCount} selected</p>
			<ul>
				{tasks.map((task) => (
					<li
						key={task.id}
						onClick={() => toggle(task)}
						style={{ fontWeight: isSelected(task) ? "bold" : "normal" }}
					>
						{task.title}
					</li>
				))}
			</ul>
		</div>
	);
}
```

---

## API Reference

### Parameters

`useMultipleSelection` accepts a single options object. It works in one of two modes, depending on whether you give it a `T` that's already an id, or an object type:

- **id-only mode** (default): pass a plain `string[]`/`number[]` (or nothing at all). No `field`.
- **object mode**: pass an array of objects as `items`, plus `field` telling the hook which property is the id. `field` is **required** in this mode, and only accepts a property that actually exists on your item and whose value is a valid id — anything else is a compile error, not a runtime surprise.

| Parameter            | Type                                                  | Required                          | Description                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`               | `readonly T[]`                                        | No                                 | The full source array the hook operates on. Bulk methods (`selectAll`, `toggleAll`, `invertSelection`) are computed against this array — see [Gotchas](#gotchas--edge-cases-crucial-section). |
| `field`               | A checked key of `T`, or forbidden in id-only mode    | Conditionally (see above)          | The property used to derive each item's id. Supports dot-notation for nested properties (e.g. `field: "meta.id"`). Omit entirely when `items` is an array of primitives.                        |
| `defaultSelectedIds`  | `readonly TId[]`                                       | No                                 | The ids selected when the hook first mounts, and what `reset()` restores the selection to. Defaults to `[]`.                                                                                     |
| `isDisabled`          | `(id: TId) => boolean`                                 | No                                 | Marks certain ids as non-selectable. See [Gotchas](#gotchas--edge-cases-crucial-section) for exactly which operations this affects.                                                              |

> `TId` defaults to `SelectionId` (`string | number`). Narrow it (e.g. `useMultipleSelection<Task, TaskId>(...)`) for a branded id type, if you have one.

### Return Values

| Property / Method                    | Type                                              | Description                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectedIds`                        | `readonly TId[]`                                    | Every currently selected id, ordered to match `items`. See [Gotchas](#gotchas--edge-cases-crucial-section) for what happens with ids not in `items`. |
| `selectedCount`                      | `number`                                            | The number of currently selected ids.                                                                                                                 |
| `selectedItems`                      | `readonly T[]`                                      | The subset of `items` whose id is currently selected, in `items`' order.                                                                              |
| `isEmpty`                             | `boolean`                                           | `true` when nothing is selected.                                                                                                                      |
| `isAllSelected`                      | `boolean`                                           | `true` when every selectable (non-disabled) item in `items` is selected. Handy for a "select all" checkbox's checked state.                          |
| `isPartiallySelected`                | `boolean`                                           | `true` when some, but not all, selectable items are selected. Handy for a "select all" checkbox's indeterminate state.                               |
| `select(item)`                       | `(item: TId \| T) => void`                          | Adds a single item (or raw id) to the selection. No-ops if disabled.                                                                                  |
| `deselect(item)`                     | `(item: TId \| T) => void`                          | Removes a single item (or raw id) from the selection. Always works, even for a disabled id.                                                           |
| `toggle(item)`                       | `(item: TId \| T) => void`                          | Selects the item if unselected, deselects it if already selected. The select-direction is blocked for a disabled id.                                 |
| `isSelected(item)`                   | `(item: TId \| T) => boolean`                       | Checks whether a given item (or raw id) is currently selected.                                                                                        |
| `reset()`                             | `() => void`                                        | Resets the selection back to the current `defaultSelectedIds`. See [Gotchas](#gotchas--edge-cases-crucial-section) for exactly which value it uses.  |
| `replaceSelection(newSelectedItems)` | `(items: readonly TId[] \| readonly T[]) => void`   | Wipes the current selection and replaces it entirely with the given items/ids.                                                                        |
| `selectAll()`                         | `() => void`                                        | Selects every selectable item in `items`.                                                                                                             |
| `deselectAll()`                       | `() => void`                                        | Clears the selection completely.                                                                                                                      |
| `toggleAll()`                         | `() => void`                                        | If every selectable item is already selected, clears the selection; otherwise, selects every selectable item.                                        |
| `invertSelection()`                   | `() => void`                                        | Selects every currently unselected selectable item and deselects every currently selected one, relative to `items`.                                  |
| `selectMultiple(newItems)`           | `(items: readonly TId[] \| readonly T[]) => void`   | Adds a batch of items/ids to the existing selection, without touching what's already selected.                                                       |
| `deselectMultiple(itemsToRemove)`    | `(items: readonly TId[] \| readonly T[]) => void`   | Removes a batch of items/ids from the existing selection.                                                                                             |
| `retainOnly(itemsToRetain)`          | `(items: readonly TId[] \| readonly T[]) => void`   | Intersects the current selection with the given list — anything not in both is dropped.                                                              |

---

## Advanced Usage & Examples

### Bulk Selection & Inversion

```tsx
import { useMultipleSelection } from "@himanshu-sorathiya/react-kit/state";

interface Row {
	id: string;
	name: string;
}

function DataTable({ rows }: { rows: Row[] }) {
	const { isSelected, toggle, toggleAll, invertSelection, isAllSelected, isPartiallySelected } =
		useMultipleSelection<Row>({ items: rows, field: "id" });

	return (
		<div>
			<label>
				<input
					type="checkbox"
					checked={isAllSelected}
					ref={(el) => el && (el.indeterminate = isPartiallySelected)}
					onChange={toggleAll}
				/>
				Select All
			</label>
			<button onClick={invertSelection}>Invert Selection</button>

			<ul>
				{rows.map((row) => (
					<li key={row.id}>
						<input
							type="checkbox"
							checked={isSelected(row)}
							onChange={() => toggle(row)}
						/>
						{row.name}
					</li>
				))}
			</ul>
		</div>
	);
}
```

### Disabling Specific Items

```tsx
import { useMultipleSelection } from "@himanshu-sorathiya/react-kit/state";

interface Product {
	id: string;
	name: string;
	outOfStock: boolean;
}

function ProductSelector({ products }: { products: Product[] }) {
	const { isSelected, toggle } = useMultipleSelection<Product>({
		items: products,
		field: "id",
		isDisabled: (id) => products.find((product) => product.id === id)?.outOfStock ?? false,
	});

	return (
		<ul>
			{products.map((product) => (
				<li key={product.id}>
					<input
						type="checkbox"
						checked={isSelected(product)}
						disabled={product.outOfStock}
						onChange={() => toggle(product)}
					/>
					{product.name}
				</li>
			))}
		</ul>
	);
}
```

### Complex Filtering with `retainOnly`

Useful when an external event (e.g. a search filter or a permissions change) should prune the current selection down to only the ids that are still valid — without wiping the whole selection.

```tsx
import { useMultipleSelection } from "@himanshu-sorathiya/react-kit/state";

interface Product {
	id: string;
	name: string;
	inStock: boolean;
}

function ProductSelector({ products }: { products: Product[] }) {
	const { selectedCount, retainOnly } = useMultipleSelection<Product>({
		items: products,
		field: "id",
	});

	const pruneToInStockOnly = () => {
		const inStockIds = products
			.filter((product) => product.inStock)
			.map((product) => product.id);

		retainOnly(inStockIds);
	};

	return (
		<div>
			<p>{selectedCount} selected</p>
			<button onClick={pruneToInStockOnly}>
				Drop out-of-stock items from selection
			</button>
		</div>
	);
}
```

---

## Real-World Use Cases

- Bulk-deleting emails in an inbox-style interface
- Data table row selection with a header "select all" checkbox
- Multi-select dropdowns and combobox tag pickers
- Bulk-editing dashboards (e.g. mass status updates, mass tagging)
- Image gallery batch operations (download, delete, move to album)
- Assigning multiple tasks to a user in a project management tool
- Bulk-approving or bulk-rejecting items in a moderation queue
- Shopping cart "select items to checkout" flows
- File manager multi-select for move/copy/delete operations
- Attendee selection when sending a calendar invite or announcement

---

## Gotchas & Edge Cases (Crucial Section)

- **Bulk operation scope.** `selectAll`, `toggleAll`, and `invertSelection` all operate on the **entire `items` array passed into the hook** — they have no awareness of any filtering happening in your UI. If you render a filtered subset of a larger dataset but pass the *unfiltered* source array as `items`, these methods will act on items the user can't even see. To scope bulk actions to what's visible, pass the *filtered* array into `items`, not the raw source list.
- **`selectedIds` and ids not currently in `items`.** If a previously-selected id is no longer present in `items` (e.g. it was filtered out, or it was selected directly without ever appearing in `items`), the hook does not silently drop it — it stays in `selectedIds` and `selectedCount`, appended after the ids that are still present in `items`. This means `selectedCount` can be higher than what's visibly checked on screen if your `items` array only represents a subset (e.g. one page) of a larger selectable set. If you don't want that, prune deliberately with `retainOnly`.
- **`isDisabled` affects addition, not removal.** It's enforced on `select`, `toggle`'s select-direction, `selectAll`, `toggleAll`, `invertSelection`, `selectMultiple`, and `replaceSelection` — but never blocks `deselect`, `deselectMultiple`, `retainOnly`, `deselectAll`, or `toggle`'s deselect-direction. If an item was selected before it became disabled, it stays selected until explicitly deselected.
- **Stable `items` reference.** Passing an inline, freshly-mapped array (e.g. `items={data.map((d) => ({ ...d }))}`) on every render defeats the hook's internal memoization, since a new array reference is treated as a change every time. Memoize `items` yourself (e.g. with `useMemo`) or keep it as a stable reference from state/props.
- **Uniqueness assumption.** The hook assumes the value resolved via `field` (or the primitive itself) is unique across `items`. If two items share the same resolved id, selecting or deselecting one will affect all of them, since they're indistinguishable to the underlying `Set`.

---

## See Also

- [useSingleSelection](../useSingleSelection/README.md) — the single-selection counterpart, for radio-button-style "only one item at a time" state.
- [useTreeSelection](../useTreeSelection/README.md) — manages hierarchical selection with parent/child cascading, for checkbox trees, nested category pickers, and file explorers.
