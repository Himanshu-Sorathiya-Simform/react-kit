# useSort

A fully type-safe, framework-agnostic React hook for building complex, multi-column sorting logic — without wiring up sort state, comparators, or tie-breaking rules by hand.

## Motivation (Why this hook?)

Sorting looks trivial until your app actually needs it: a data table with several sortable columns, priority tie-breaking, nested fields like `user.profile.name`, inconsistent `null`/`undefined` data from an API, and UI that needs to cycle through ascending → descending → unsorted on click. Reimplementing this per-component leads to duplicated comparator logic and subtle bugs around undefined values.

`useSort` solves this by encapsulating:

- **Multi-column sorting state** — an ordered stack of sort configs, each contributing a tie-breaker for the next.
- **Graceful null/undefined handling** — every comparator funnels through a shared `sortUndefined` strategy so missing data never crashes a sort or lands unpredictably.
- **Multiple built-in data types** — `numeric`, `alphabetical`, `alphanumeric`, `boolean`, `date`, `basic`, and fully custom `compare` functions.
- **Nested object access via dot-notation** — sort by `field: "address.city"` without flattening your data first.
- **Click-to-cycle ergonomics** — a single `toggleSort` call handles the asc → desc → (remove or reset) state machine so you don't have to.

It's a pure state + memoized-derivation hook — no DOM assumptions, no external dependencies, and 100% client-side.

## Import Syntax

```tsx
// Preferred
import { useSort, type UseSortReturn, type SortConfig } from "@himanshu-sorathiya/react-kit/state";
// Or
import { useSort, type UseSortReturn, type SortConfig } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

A minimal example: a table header that cycles a single column through ascending, descending, and unsorted.

```tsx
import { useSort } from "@himanshu-sorathiya/react-kit/state";

interface Product {
	id: string;
	name: string;
	price: number;
}

function ProductTable({ products }: { products: Product[] }) {
	const { sortedItems, toggleSort, getSortDirection } = useSort<Product>(products);

	return (
		<table>
			<thead>
				<tr>
					<th onClick={() => toggleSort("price", "numeric")}>
						Price ({getSortDirection("price") ?? "none"})
					</th>
				</tr>
			</thead>
			<tbody>
				{sortedItems.map((product) => (
					<tr key={product.id}>
						<td>{product.price}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
```

## API Reference

### Parameters

| Parameter      | Type            | Required | Description                                                                                   |
| -------------- | --------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `data`         | `T[]`           | Yes      | The source array to sort. `useSort` never mutates it — it returns a new sorted array.           |
| `initialSorts` | `SortState`     | No       | The initial sort stack (defaults to `[]`). Also used as the target state for `resetSorts()`.     |

### Return Values

| Property              | Type                                                                                          | Description                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `sortedItems`          | `T[]`                                                                                            | The `data` array sorted according to the current `sorts` stack. Recomputed via `useMemo` when `sorts` or `data` change.       |
| `sorts`                | `SortState`                                                                                       | The current ordered array of active `SortConfig` entries.                                                                     |
| `upsertSorts(sort)`          | `(sort: SortConfig) => void`                                                                     | Inserts a new sort config, or replaces the existing one sharing the same `id`.                                                |
| `removeSort(id)`           | `(id: string \| string[]) => void`                                                              | Removes one sort (by `id`) or several at once (by an array of `id`s).                                                         |
| `clearSorts()`           | `() => void`                                                                                     | Clears the entire sort stack.                                                                                                 |
| `resetSorts()`           | `() => void`                                                                                     | Restores the sort stack to the `initialSorts` value passed on mount.                                                          |
| `replaceSorts(sorts)`         | `(sorts: SortState) => void`                                                                     | Overwrites the entire sort stack with a new one, in one call.                                                                 |
| `toggleSort(id, type, options)`           | `<TType>(id: string, type: TType, options?: SortOptionsForType<TType> & { multi?: boolean; field?: string }) => void` | Cycles a column's sort state (see the state-machine breakdown below).                                            |
| `getSortDirection(id)`     | `(id: string) => "asc" \| "desc" \| undefined`                                                  | Returns the current direction for a given sort `id`, or `undefined` if it isn't active.                                       |
| `getNextSortingOrder(id)`  | `(id: string) => "asc" \| "desc" \| "none"`                                                     | Returns what direction `toggleSort` would move to next, useful for rendering the correct sort-arrow icon ahead of a click.     |
| `getSortIndex(id)`         | `(id: string) => number \| undefined`                                                           | Returns the 1-based priority position of a sort `id` in the stack (handy for showing "2" badges in multi-column sorting UIs). |

### Configuration Options

`SortConfig` extends `BaseSortConfig`, which extends `BaseSortOptions`. Together they control both *what* is sorted and *how*.

| Option               | Type                                             | Applies To                          | Description                                                                                                                       |
| --------------------- | -------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | `string`                                            | All types                            | Unique key for this sort. Also used to resolve the field path via dot-notation if `field` is omitted.                              |
| `field`               | `string`                                            | All types                            | Optional dot-notation path (e.g. `"address.city"`) used instead of `id` to read the sort value from each item.                     |
| `type`                | `SortType`                                          | All types                            | One of `"numeric" \| "alphabetical" \| "alphanumeric" \| "boolean" \| "date" \| "basic" \| "custom"`.                              |
| `desc`                | `boolean`                                           | All types                            | Sorts descending when `true`. Defaults to `false`.                                                                                  |
| `disableSortRemoval`  | `boolean`                                           | All types                            | When `true`, `toggleSort` will never fully remove this sort — it cycles back to ascending instead of clearing.                    |
| `invertSorting`       | `boolean`                                           | All types                            | Flips the effective sort direction, independent of `desc`. Useful for columns where "ascending" should mean the opposite order.    |
| `sortUndefined`       | `"first" \| "last" \| -1 \| 1`                      | All types                            | Controls placement of `null`/`undefined`/`""` values: pin them `"first"` or `"last"`, or use `-1`/`1` to respect the active `desc` direction. Defaults to `"last"`.|
| `caseSensitive`       | `boolean`                                           | `"alphabetical"`, `"alphanumeric"`   | When `true`, uppercase/lowercase are treated as distinct during comparison. Defaults to `false`.                                    |
| `compare`             | `(a: unknown, b: unknown) => number`                | `"custom"`                           | Required custom comparator for the `"custom"` type, invoked with the two raw field values.                                          |

## Advanced Usage & Examples

### Multi-Column Sorting

Pass `multi: true` to `toggleSort` to build a priority stack instead of replacing the active sort. `getSortIndex` returns each column's priority position for display.

```tsx
import { useSort } from "@himanshu-sorathiya/react-kit/state";

interface Contact {
	id: string;
	lastName: string;
	firstName: string;
}

function ContactList({ contacts }: { contacts: Contact[] }) {
	const { sortedItems, toggleSort, getSortIndex, getSortDirection } = useSort<Contact>(contacts);

	return (
		<table>
			<thead>
				<tr>
					<th onClick={() => toggleSort("lastName", "alphabetical", { multi: true })}>
						Last Name {getSortIndex("lastName") ?? ""} ({getSortDirection("lastName") ?? "none"})
					</th>
					<th onClick={() => toggleSort("firstName", "alphabetical", { multi: true })}>
						First Name {getSortIndex("firstName") ?? ""} ({getSortDirection("firstName") ?? "none"})
					</th>
				</tr>
			</thead>
			<tbody>
				{sortedItems.map((contact) => (
					<tr key={contact.id}>
						<td>{contact.lastName}</td>
						<td>{contact.firstName}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
```

### Custom Comparator

Use `type: "custom"` when your sort logic doesn't map to a built-in type — for example, sorting by a fixed priority-label order rather than alphabetically.

```tsx
import { useSort } from "@himanshu-sorathiya/react-kit/state";

interface Task {
	id: string;
	title: string;
	priority: "low" | "medium" | "high";
}

const PRIORITY_RANK: Record<Task["priority"], number> = { low: 0, medium: 1, high: 2 };

function TaskQueue({ tasks }: { tasks: Task[] }) {
	const { sortedItems, upsertSorts } = useSort<Task>(tasks, [
		{
			id: "priority",
			type: "custom",
			desc: true,
			compare: (a, b) => PRIORITY_RANK[a as Task["priority"]] - PRIORITY_RANK[b as Task["priority"]],
		},
	]);

	return (
		<ul>
			{sortedItems.map((task) => (
				<li key={task.id}>{task.title}</li>
			))}
		</ul>
	);
}
```

## Real-World Use Cases

- E-commerce product grids with "Price: Low to High" / "Price: High to Low" toggles.
- Multi-column admin data tables where users can stack sorts (e.g. Department, then Name).
- Contact lists sorted by "Last Name" then "First Name" as a tie-breaker.
- Task or ticket queues sorted by "Priority" and then "Due Date".
- Leaderboard views ranking players by score, with wins as a tie-breaker.
- Financial transaction logs sorted by "Date" with undefined/pending amounts pushed to the bottom.
- File managers sorting by "Name" (alphanumeric, so `file2` sorts before `file10`).
- CRM pipelines sorting deals by custom stage order rather than alphabetical stage names.
- Inventory dashboards sorting by "In Stock" boolean status, then by SKU.
- Nested employee directories sorted by `field: "department.name"` dot-notation paths.

## Gotchas & Edge Cases

- **Data Stability.** `sortedItems` is derived with `useMemo` keyed on `[sorts, data]`. If you pass an inline-mapped or newly-created array as `data` (e.g. `data.filter(...)` inline in JSX), it gets a new reference on every render, forcing the sort to recompute even when nothing meaningful changed. Memoize `data` yourself (`useMemo`, or hoist it out of the render body) whenever the source list is large or expensive to derive.

- **Undefined Values.** Real-world data is rarely complete. The `sortUndefined` option gives you granular control: `"first"` or `"last"` pin missing values (`null`, `undefined`, or `""`) to one end of the list regardless of direction, while `-1` and `1` make their placement direction-aware, flipping alongside `desc`. Without setting this, missing values default to being sorted last.

- **Multi-Sort State.** `toggleSort(id, type, options)` defaults to `multi: false`, meaning each click **replaces** the entire sort stack with just that one column — ideal for single-column table headers. Pass `multi: true` to instead append the column to the stack (or update it in place if it's already active), building up prioritized multi-column sorting. Note that `disableSortRemoval` changes the cycle: instead of removing a sort on its third click, it resets back to ascending.

## See Also

- [useFilter](../useFilter/README.md) — declarative, type-safe filtering to pair with `useSort` for full data-table pipelines.
- [useOrder](../useOrder/README.md) — manual drag-and-drop / manual reordering of list items, independent of comparator-based sorting.
- [usePagination](../usePagination/README.md) — client-side pagination state to slice `sortedItems` into pages.
- [useMultipleSelection](../useMultipleSelection/README.md) — manage multi-row selection state alongside sorted or filtered lists.
