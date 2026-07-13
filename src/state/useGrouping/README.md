# `useGrouping`

A lightweight, fully type-safe React hook for grouping arrays of objects into both a keyed `Record` and an iterable `Array`, with support for dot-notation nested keys and graceful handling of missing data.

---

## Motivation (Why this hook?)

Grouping data is one of those tasks that *looks* trivial but quietly accumulates complexity. A naive implementation usually starts as a `reduce` call scattered inside a component body, and before long you're re-deriving the same logic for every list in your app — recalculating on every render, duplicating null-checks, and hand-rolling both a lookup object *and* a renderable array depending on what the current UI needs.

`useGrouping` solves this once, properly:

- **Memoized by default.** The grouping computation is wrapped in `useMemo`, so it only re-runs when `items` or the active grouping field actually change — no redundant `reduce` passes on every re-render.
- **Two shapes, one source of truth.** You get a `groupedRecord` (ideal for O(1) lookups by key) *and* a `groupedArray` (ideal for `.map()`-ing directly into JSX) derived from the same computation, so you never have to convert between them yourself.
- **Dot-notation support out of the box.** Need to group by a nested field like `metadata.category`? Just pass the string — no need to write a custom accessor function.
- **Graceful with messy data.** Items missing the target field, or where the field resolves to `null`/`undefined`, are automatically bucketed into a predictable `"Unknown"` group instead of throwing or silently dropping data.

In short: stop writing the same `reduce` function in every component. Configure it once, and let the hook handle memoization, key derivation, and edge cases for you.

---

## Import Syntax

```tsx
import { useGrouping, type UseGroupingReturn, type Group } from "@himanshu-sorathiya/react-kit";
```

---

## Basic Usage

Group a flat array of user objects by a simple top-level field like `"role"`:

```tsx
import { useGrouping } from "@himanshu-sorathiya/react-kit";

interface User {
	id: number;
	name: string;
	role: "admin" | "user" | "guest";
}

const users: User[] = [
	{ id: 1, name: "Ava", role: "admin" },
	{ id: 2, name: "Ben", role: "user" },
	{ id: 3, name: "Cy", role: "guest" },
	{ id: 4, name: "Dee", role: "user" },
];

function UserList() {
	const { groupedArray } = useGrouping<User>({
		items: users,
		initialGroupBy: "role",
	});

	return (
		<div>
			{groupedArray.map((group) => (
				<section key={group.key}>
					<h3>{group.key}</h3>
					<ul>
						{group.items.map((user) => (
							<li key={user.id}>{user.name}</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
```

---

## API Reference

### Parameters

`useGrouping` accepts a single configuration object:

| Parameter        | Type      | Required | Description                                                                                                   |
| ----------------- | --------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `items`           | `T[]`     | Yes      | The source array of objects to group.                                                                          |
| `initialGroupBy`  | `string`  | No       | The field to group by on initial render. Supports dot-notation for nested fields (e.g. `"metadata.category"`). If omitted, items start ungrouped. |

### Return Values

`useGrouping` returns an object (typed as `UseGroupingReturn<T>`) with the following properties and methods:

| Property / Method  | Type                                | Description                                                                                                                                                                 |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groupedRecord`      | `Record<string, T[]>`               | A lookup object mapping each group key to its array of items. When no field is active, this is `{ Ungrouped: items }`.                                                     |
| `groupedArray`       | `Group<T>[]`                        | The same grouped data as an iterable array — ideal for `.map()` in JSX. Each entry has the shape `{ key: string; items: T[] }`.                                            |
| `groupKeys`          | `string[]`                          | An array of every group key currently present (i.e. `Object.keys(groupedRecord)`).                                                                                        |
| `totalGroups`        | `number`                            | The total count of distinct groups (equivalent to `groupKeys.length`).                                                                                                     |
| `activeGroupBy`      | `string \| undefined`               | The field currently being used to group items, or `undefined` if grouping is cleared.                                                                                     |
| `changeGroupBy(newField)`      | `(newField: string) => void`        | Sets `activeGroupBy` to `newField`, triggering a recomputation of the groups on that field.                                                                                |
| `clearGrouping()`      | `() => void`                        | Resets `activeGroupBy` to `undefined`, collapsing all items back into a single `Ungrouped` bucket.                                                                          |
| `resetGrouping()`      | `() => void`                        | Restores `activeGroupBy` back to whatever `initialGroupBy` was passed in at hook initialization (not necessarily `undefined`).                                             |
| `getGroupItems(groupKey)`      | `(groupKey: string) => T[]`         | Takes a group key and returns the corresponding array of items from `groupedRecord`. Returns an empty array (`[]`) if the key doesn't exist.                              |

### The `Group<T>` Interface

Each entry in `groupedArray` conforms to this shape:

```ts
interface Group<T> {
	key: string;
	items: T[];
}
```

---

## Advanced Usage & Examples

### Dynamic Grouping & Dot-Notation

Switch grouping between a flat key and a deeply nested key at runtime using `changeGroupBy`:

```tsx
import { useGrouping } from "@himanshu-sorathiya/react-kit";

interface Product {
	id: number;
	name: string;
	status: "active" | "discontinued";
	metadata: {
		category: string;
	};
}

const products: Product[] = [
	{ id: 1, name: "Widget", status: "active", metadata: { category: "Tools" } },
	{ id: 2, name: "Gadget", status: "discontinued", metadata: { category: "Electronics" } },
	{ id: 3, name: "Gizmo", status: "active", metadata: { category: "Electronics" } },
];

function ProductBoard() {
	const { groupedArray, activeGroupBy, changeGroupBy } = useGrouping<Product>({
		items: products,
		initialGroupBy: "status",
	});

	return (
		<div>
			<select
				value={activeGroupBy}
				onChange={(e) => changeGroupBy(e.target.value)}
			>
				<option value="status">Status</option>
				<option value="metadata.category">Category</option>
			</select>

			{groupedArray.map((group) => (
				<div key={group.key}>
					<h4>{group.key}</h4>
					<p>{group.items.length} item(s)</p>
				</div>
			))}
		</div>
	);
}
```

### Clearing & Resetting Groupings

```tsx
import { useGrouping } from "@himanshu-sorathiya/react-kit";

interface Task {
	id: number;
	title: string;
	priority: "low" | "medium" | "high";
}

const tasks: Task[] = [
	{ id: 1, title: "Fix bug", priority: "high" },
	{ id: 2, title: "Write docs", priority: "low" },
];

function TaskBoard() {
	const { groupedArray, clearGrouping, resetGrouping } = useGrouping<Task>({
		items: tasks,
		initialGroupBy: "priority",
	});

	return (
		<div>
			<button onClick={clearGrouping}>Clear Grouping</button>
			<button onClick={resetGrouping}>Reset to Default</button>

			{groupedArray.map((group) => (
				<div key={group.key}>{group.key}: {group.items.length}</div>
			))}
		</div>
	);
}
```

---

## Real-World Use Cases

- Kanban boards grouping cards by `status` (e.g. To Do, In Progress, Done)
- E-commerce product grids grouping items by `brand` or nested `metadata.category`
- Contact directories grouping people by `department` or `team`
- Transaction histories grouping records by `month` or `year`
- Support ticket dashboards grouping issues by `priority` or `assignee`
- Event schedules grouping sessions by `date` or `venue`
- Inventory systems grouping stock items by `warehouseLocation`
- Job boards grouping listings by `employmentType` or `location`
- Survey response viewers grouping answers by `respondentSegment`
- Content libraries grouping media files by `fileType` or `folder`

---

## Gotchas & Edge Cases

**Object Arrays Preferred**
Because grouping relies on reading a string field (`activeGroupBy`) off each item, this hook is designed for arrays of *objects*. It does not natively support grouping arrays of primitives (e.g. `[1, 2, 2, 3]`) — wrap primitives in objects first (e.g. `{ value: 1 }`) if you need to group them.

**The `"Unknown"` Group Fallback**
If an item is missing the specified field, or the field resolves to `null` or `undefined`, that item is automatically placed into a group keyed `"Unknown"`. This keeps the hook from throwing on incomplete data, but it also means you should watch for an `"Unknown"` key appearing in `groupKeys` if your data isn't fully sanitized.

**The `"Ungrouped"` Fallback**
If `initialGroupBy` isn't provided, or if `clearGrouping()` is called, `activeGroupBy` becomes `undefined` and all items collapse into a single record: `{ Ungrouped: items }`. Design your UI to expect this key when grouping is inactive.

**Stable `items` Reference**
The internal `useMemo` optimizations depend on `items` maintaining a stable reference between renders. Passing an inline mapped or filtered array directly as a prop (e.g. `items={data.map(x => x)}`) creates a brand-new array on every render, defeating memoization and causing groups to recompute unnecessarily. Memoize `items` yourself (e.g. with `useMemo`) upstream if it's derived from a transformation.

---

## See Also

- **[useFilter](../useFilter/README.md)** — Filters lists based on one or more conditions, letting you narrow down a dataset before (or after) grouping it.
- **[useSort](../useSort/README.md)** — Handles sorting of complex data structures, including nested and multi-field sort criteria.
