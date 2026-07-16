# useMultipleSelection

A strictly type-safe, fully client-side React hook for managing multi-item selection state — built for lists, tables, grids, and any UI where users need to select more than one thing at a time.

---

## Motivation (Why this hook?)

Selection state looks trivial until you actually build it. What starts as a single `useState<Set<string>>` quietly grows into a pile of one-off helper functions: one for toggling a row, one for "select all," one for "select all *visible*," one for inverting a selection, one for cleaning up stale IDs after a filter or search changes the underlying dataset. Each of these is easy to get subtly wrong — especially around Set immutability, where forgetting to clone before mutating leads to missed re-renders.

`useMultipleSelection` collapses all of that into a single, predictable API:

- **Encapsulates the hard parts.** Operations like `invertSelection`, `retainOnly`, and `toggleAll` are notoriously fiddly to hand-roll correctly — they all require careful handling of overlap between "already selected" and "candidate" sets. This hook implements them once, correctly, so you don't have to.
- **Type-safe by design.** The hook is generic over your item type `T`, so `selectedItems` comes back fully typed — no `as` casts, no `unknown` leaking into your components.
- **Performant by default.** Selection is stored internally as a `Set`, giving O(1) membership checks for `isSelected`, and `selectedItems` is derived via `useMemo` so it's only recomputed when `items`, `field`, or `selectedIds` actually change.
- **Works with primitives *and* objects, automatically.** Whether your list is `string[]`, `number[]`, or an array of rich objects, the hook resolves the correct identity for each item behind the scenes via its internal `getValue` helper — you just tell it which `field` to use (or omit it entirely for primitives).

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

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `items` | `T[]` | Yes | The full source array the hook operates on. Bulk methods (`selectAll`, `toggleAll`, `invertSelection`) are computed against this array — see [Gotchas](#gotchas--edge-cases-crucial-section). |
| `field` | `string` | No | The property key used to derive a unique identity from each item, via the internal `getValue(item, field)` helper. **Omit this when `items` is an array of primitives** (`string[]` / `number[]`) — in that case, the item itself is used as its own identity. **Provide this when `items` is an array of objects** (e.g. `field: "id"`) so the hook knows which property to key selection off of. `getValue` also supports dot-notation paths (e.g. `field: "meta.id"`) for nested properties. |
| `initialSelectedIds` | `SelectionId[]` (`(string \| number)[]`) | No | The IDs that should be selected when the hook first mounts. Defaults to `[]`. This value is captured once in a ref and reused whenever `resetSelection()` is called, even if the prop itself changes later. |

> `SelectionId` is defined as `string | number`.

### Return Values

| Property / Method | Type | Description |
| --- | --- | --- |
| `selectedIds` | `SelectionId[]` | A fresh array snapshot of every currently selected ID. |
| `selectedCount` | `number` | The number of currently selected IDs. Equivalent to `selectedIds.length`. |
| `selectedItems` | `T[]` | The subset of `items` whose derived ID is currently selected. Memoized against `items`, `field`, and the selection state. |
| `isEmpty` | `boolean` | `true` when nothing is selected. |
| `select(item)` | `(item: SelectionId \| T) => void` | Adds a single item (or raw ID) to the selection. |
| `deselect(item)` | `(item: SelectionId \| T) => void` | Removes a single item (or raw ID) from the selection. |
| `toggle(item)` | `(item: SelectionId \| T) => void` | Selects the item if unselected, deselects it if already selected. |
| `isSelected(item)` | `(item: SelectionId \| T) => boolean` | Checks whether a given item (or raw ID) is currently selected. |
| `resetSelection()` | `() => void` | Resets the selection back to the original `initialSelectedIds` captured on mount. |
| `replaceSelection(newSelectedItems)` | `(items: SelectionId[] \| T[]) => void` | Wipes the current selection and replaces it entirely with the given items/IDs. |
| `selectAll()` | `() => void` | Selects every item in the `items` array. |
| `deselectAll()` | `() => void` | Clears the selection completely. |
| `toggleAll()` | `() => void` | If every item is already selected, clears the selection; otherwise, selects every item. |
| `invertSelection()` | `() => void` | Selects every currently unselected item and deselects every currently selected one, relative to `items`. |
| `selectMultiple(newItems)` | `(items: SelectionId[] \| T[]) => void` | Adds a batch of items/IDs to the existing selection, without touching what's already selected. |
| `deselectMultiple(itemsToRemove)` | `(items: SelectionId[] \| T[]) => void` | Removes a batch of items/IDs from the existing selection. |
| `retainOnly(itemsToRetain)` | `(items: SelectionId[] \| T[]) => void` | Intersects the current selection with the given list — anything not in both is dropped. |

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
	const { selectedCount, isSelected, toggle, toggleAll, invertSelection } =
		useMultipleSelection<Row>({ items: rows, field: "id" });

	const allSelected = selectedCount === rows.length;

	return (
		<div>
			<label>
				<input type="checkbox" checked={allSelected} onChange={toggleAll} />
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

### Complex Filtering with `retainOnly`

Useful when an external event (e.g. a search filter or a permissions change) should prune the current selection down to only the IDs that are still valid — without wiping the whole selection.

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
- **`selectedIds` reference identity.** `selectedIds` is computed as `[...selectedIds]` on every render, which means it is a **brand-new array reference each time**, even if its contents haven't changed. Do not put `selectedIds` directly into a `useEffect` (or similar) dependency array — it will re-run on every render and can easily cause infinite loops. Depend on `selectedCount` instead when you just need to react to the selection changing.
- **Stable `items` reference.** Passing an inline, freshly-mapped array (e.g. `items={data.map((d) => ({ ...d }))}`) on every render defeats the hook's internal `useMemo` for `selectedItems`, since a new array reference is treated as a change every time. Memoize `items` yourself (e.g. with `useMemo`) or keep it as a stable reference from state/props.
- **Uniqueness assumption.** The hook assumes the value resolved via `field` (or the primitive itself) is unique across `items`. If two items share the same resolved ID, selecting or deselecting one will affect all of them, since they're indistinguishable to the underlying `Set`.

---

## See Also

- [useSingleSelection](../useSingleSelection/README.md) — the single-selection counterpart, for radio-button-style "only one item at a time" state.
- [useOrder](../useOrder/README.md) — manage and manipulate ordering/sequencing of a list of items.
- [useSort](../useSort/README.md) — declarative sorting state for lists and tables.
- [useFilter](../useFilter/README.md) — declarative filtering state, a natural pairing with `useMultipleSelection` when working with filtered subsets.
