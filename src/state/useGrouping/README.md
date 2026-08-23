# useGrouping

A lightweight, fully type-safe React hook for partitioning arrays into groups — single-level or hierarchical, by field value, date bucket, or a fully custom key function.

---

## Motivation (Why this hook?)

Grouping data is one of those tasks that *looks* trivial but quietly accumulates complexity. A naive implementation usually starts as a `reduce` call scattered inside a component body, and before long you're re-deriving the same logic for every list in your app — recalculating on every render, duplicating null-checks, and hand-rolling nested groupings (department, then status, then...) as a chain of separate `reduce` passes.

`useGrouping` solves this once, properly:

- **Memoized by default.** The grouping computation is wrapped in `useMemo`, so it only re-runs when `data` or the active grouping configuration actually changes.
- **Hierarchical, not just flat.** Pass an array of grouping levels instead of a single field, and each level nests inside the one before it — group by region, then by month, in one call.
- **Two shapes, one source of truth.** You get a `groupedArray` (ideal for `.map()`-ing directly into JSX, and the only shape that carries nested levels) *and* a `groupedRecord` (ideal for O(1) top-level lookups) derived from the same computation.
- **Dot-notation and date bucketing out of the box.** Group by a nested field like `metadata.category`, or by a `Date` field bucketed to day/month/year, without writing an accessor function.
- **An escape hatch for anything else.** A `type: "custom"` level lets you supply your own key-deriving function when a plain field or date bucket isn't enough.
- **Graceful with messy data.** Items with a missing, blank, or otherwise unresolvable value at a given level are automatically bucketed into a predictable group instead of throwing or silently dropping data.

## Import Syntax

```tsx
// Preferred
import { useGrouping, type UseGroupingReturn, type Group } from "@himanshu-sorathiya/react-kit/state";
// Or
import { useGrouping, type UseGroupingReturn, type Group } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

Group a flat array of user objects by a simple top-level field like `"role"`:

```tsx
import { useGrouping } from "@himanshu-sorathiya/react-kit/state";

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
	const { groupedArray } = useGrouping<User>(users, "role");

	return (
		<div>
			{groupedArray.map((group) => (
				<section key={group.key}>
					<h3>{group.label}</h3>
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

## API Reference

### Parameters

| Parameter        | Type                                       | Required | Description                                                                                                   |
| ----------------- | ------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `data`            | `T[]`                                       | Yes      | The source array to group.                                                                                    |
| `initialGroupBy`  | `GroupByLevel<T> \| GroupByLevel<T>[]`      | No       | The grouping level(s) applied at mount, and the target state for `resetGrouping()`. Omit for no initial grouping. |
| `options`         | `UseGroupingOptions`                        | No       | See [Options](#options) below.                                                                                 |

#### Options

| Property             | Type      | Default        | Description                                                                                                                                                 |
| --------------------- | --------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defer`               | `boolean` | `false`        | When `true`, the grouping recomputation is deferred (via React's `useDeferredValue`) so changing the active grouping doesn't block a more urgent update. `data` itself is never deferred. |
| `unknownGroupLabel`   | `string`  | `"Unknown"`    | Label for the synthetic bucket holding items whose value at a level is missing, blank, or otherwise unresolvable.                                          |
| `ungroupedGroupLabel` | `string`  | `"Ungrouped"`  | Label for the single synthetic group returned when no grouping levels are applied at all.                                                                   |

### Return Values

| Property / Method            | Type                                              | Description                                                                                                                    |
| ------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `groupedArray`                  | `Group<T>[]`                                          | All groups, hierarchically — top-level groups from the first grouping level, each optionally holding `subGroups` from deeper levels. Use this for anything beyond a single flat level. |
| `groupedRecord`                 | `Record<string, T[]>`                                 | **Top-level groups only**, flattened to a lookup object. For deeper levels, traverse a group's `subGroups` directly via `groupedArray`. |
| `groupKeys`                     | `string[]`                                            | **Top-level** group keys only, in the same order as `groupedArray`.                                                            |
| `totalGroups`                   | `number`                                              | Count of **top-level** groups only — `groupKeys.length`.                                                                       |
| `activeGroupBy`                 | `NormalizedGroupByLevel<T>[]`                         | The currently-applied grouping levels, always normalized to an array (a string shorthand you passed in is expanded to its full object form). Empty when no grouping is applied. |
| `hasActiveGrouping`             | `boolean`                                             | `activeGroupBy.length > 0`.                                                                                                    |
| `unknownGroupKey`                | `string`                                              | The actual label in use for the "missing/unresolvable value" bucket — reflects `options.unknownGroupLabel` if customized. Compare a group's `key` against this rather than hardcoding `"Unknown"`. |
| `ungroupedGroupKey`              | `string`                                              | The actual label in use for the "no grouping applied" bucket — same customization caveat as above.                            |
| `changeGroupBy(newGroupBy)`     | `(newGroupBy: GroupByLevel<T> \| GroupByLevel<T>[]) => void` | Replaces `activeGroupBy` with one level or an array of levels. Order determines nesting — the first level becomes the top level. Rejected if any level is malformed — see [Validation](#validation--dev-mode-errors). |
| `clearGrouping()`               | `() => void`                                          | Clears `activeGroupBy` entirely — equivalent to `changeGroupBy([])`.                                                            |
| `resetGrouping()`               | `() => void`                                          | Restores `activeGroupBy` to the value passed as `initialGroupBy` **at mount** — later changes to that argument on subsequent renders don't change what this restores. |
| `getGroup(groupKey)`            | `(groupKey: string) => Group<T> \| undefined`         | Looks up a single **top-level** group by its `key`. `undefined` if no such group exists. Use `groupedArray`/`subGroups` directly for a nested group.       |
| `getGroupItems(groupKey)`       | `(groupKey: string) => T[]`                           | `getGroup(groupKey)?.items ?? []` — the items in a top-level group, or an empty array if it doesn't exist.                     |

### The `Group<T>` Interface

Each entry in `groupedArray` (and each entry in a group's `subGroups`) conforms to this shape:

```ts
interface Group<T> {
	key: string;
	label: string;
	items: T[]; // ALL items under this group, flattened across any deeper levels
	subGroups?: Group<T>[]; // present only when there's another grouping level below this one
}
```

`key` and `label` are usually identical, except for date-bucketed levels, where `key` is a zero-padded sortable string (e.g. `"2026-08"`) and `label` is a formatted, human-readable version (e.g. `"August 2026"`).

### Grouping Level Reference

`initialGroupBy` / `changeGroupBy` accept one level, or an array of levels for hierarchical grouping (the array's order determines nesting — `levels[0]` produces the top-level groups, `levels[1]` subgroups within each, and so on).

| Level shape | Description |
| ----------- | ----------- |
| `"someField"` (plain string) | Shorthand for `{ type: "field", field: "someField" }`. |
| `{ type: "field", field }` | Groups by a field's raw value. Dot-notation supported (`"address.city"`). |
| `{ type: "date", field, bucket? }` | Groups by a `Date`-valued field, bucketed to `"day"` (default), `"month"`, or `"year"` — avoids one group per unique timestamp. |
| `{ type: "custom", getKey, id? }` | Groups by a caller-supplied function: `(item: T) => string \| string[] \| null \| undefined`. `id` is optional and used only to identify the level in dev warnings. |

## Advanced Usage & Examples

### Hierarchical (Multi-Level) Grouping

Pass an array of levels to nest groups within groups — here, orders grouped by region, then by the month they were placed:

```tsx
import { useGrouping } from "@himanshu-sorathiya/react-kit/state";

interface Order {
	id: string;
	region: string;
	placedAt: string; // ISO timestamp
}

function OrdersByRegionAndMonth({ orders }: { orders: Order[] }) {
	const { groupedArray } = useGrouping<Order>(orders, [
		"region",
		{ type: "date", field: "placedAt", bucket: "month" },
	]);

	return (
		<div>
			{groupedArray.map((regionGroup) => (
				<section key={regionGroup.key}>
					<h3>{regionGroup.label}</h3>
					{regionGroup.subGroups?.map((monthGroup) => (
						<div key={monthGroup.key}>
							<h4>{monthGroup.label}</h4>
							<p>{monthGroup.items.length} order(s)</p>
						</div>
					))}
				</section>
			))}
		</div>
	);
}
```

### Grouping by a Multi-Value Field (Fan-Out)

If a field's value is an array (e.g. `tags`), an item is placed into *every* matching group, not just one — the standard "this email has three labels, so it shows up under all three" pattern.

```tsx
import { useGrouping } from "@himanshu-sorathiya/react-kit/state";

interface Article {
	id: string;
	title: string;
	tags: string[];
}

function ArticlesByTag({ articles }: { articles: Article[] }) {
	const { groupedArray } = useGrouping<Article>(articles, "tags");

	// An article tagged ["react", "typescript"] appears in BOTH groups below.
	return (
		<div>
			{groupedArray.map((group) => (
				<section key={group.key}>
					<h3>{group.label} ({group.items.length})</h3>
				</section>
			))}
		</div>
	);
}
```

### Custom Grouping Logic

Use `type: "custom"` to derive a key that isn't a direct field value — for example, bucketing by a price range.

```tsx
import { useGrouping } from "@himanshu-sorathiya/react-kit/state";

interface Product {
	id: string;
	name: string;
	price: number;
}

function priceRangeKey(product: Product): string {
	if (product.price < 25) return "Under $25";
	if (product.price < 100) return "$25 - $100";
	return "Over $100";
}

function ProductsByPriceRange({ products }: { products: Product[] }) {
	const { groupedArray, changeGroupBy } = useGrouping<Product>(products);

	changeGroupBy({ type: "custom", id: "priceRange", getKey: priceRangeKey });

	return (
		<div>
			{groupedArray.map((group) => (
				<section key={group.key}>
					<h3>{group.label}</h3>
					<p>{group.items.length} product(s)</p>
				</section>
			))}
		</div>
	);
}
```

## Real-World Use Cases

- Kanban boards grouping cards by `status` (e.g. To Do, In Progress, Done)
- E-commerce product grids grouping items by `brand`, or hierarchically by `category` then `subcategory`
- Contact directories grouping people by `department` or `team`
- Transaction histories grouped by a `month` or `year` date bucket, without manually extracting the month yourself
- Support ticket dashboards grouping issues by `priority`, then by `assignee`
- Event schedules grouping sessions by `date` bucket, then by `venue`
- Inventory systems grouping stock items by `warehouseLocation`
- Job boards grouping listings by `employmentType` or `location`
- Content libraries where an item can belong to multiple groups at once (tags, categories) via fan-out
- Analytics dashboards bucketing values into custom ranges (price tiers, score bands) via a `custom` level

## Gotchas & Edge Cases

### Fan-Out, Not Partitioning

If a level's resolved value for an item is an array (an array-valued field, or a `custom` level's `getKey` returning multiple keys), the item is placed in **every** matching group at that level — not just one. This means summed item counts across sibling groups can exceed `data.length`; that reflects genuine multi-group membership, not a bug. If you're used to a partitioning-style `groupBy` (e.g. lodash's, where every item lands in exactly one group), this is the one behavior most likely to surprise you.

### Two Distinct Synthetic Buckets

- **`unknownGroupKey`** (default label `"Unknown"`) — items whose value at a level is missing, blank/whitespace-only, a non-primitive object, or otherwise unresolvable (an unparseable date, a `custom` level's `getKey` throwing or returning an invalid shape).
- **`ungroupedGroupKey`** (default label `"Ungrouped"`) — the single group returned when no grouping levels are applied at all.

Both are customizable via `options`. The actual strings in use are always available as `unknownGroupKey`/`ungroupedGroupKey` on the return value — compare a group's `key` against those rather than hardcoding `"Unknown"`/`"Ungrouped"`, in case they've been customized.

### Top-Level-Only Accessors

`groupedRecord`, `groupKeys`, `totalGroups`, `getGroup`, and `getGroupItems` all operate on **top-level groups only**. For anything below the first grouping level in a hierarchical setup, traverse a `Group`'s `subGroups` directly via `groupedArray`.

### Group Order

Groups (at every level) appear in first-appearance order within `data`/their parent group — not alphabetically, not by size. Re-sort `groupedArray` yourself (e.g. with `useSort`) if a specific order is needed.

### Object Arrays Preferred

Grouping is designed for arrays of *objects*. A field resolving to a nested object (rather than a primitive) is excluded from that item's group keys rather than being stringified into a meaningless `"[object Object]"` bucket — if that leaves nothing for the item to key by, it falls into `unknownGroupKey`. Primitive arrays (e.g. `[1, 2, 2, 3]`) aren't an officially supported input shape; wrap primitives in objects first (e.g. `{ value: 1 }`) if you need to group them.

### Validation & Dev-Mode Errors

- **A malformed grouping level** (a `field`/`date` level with a missing/empty `field`, an invalid `bucket`, or a `custom` level with a non-function `getKey`) passed to `initialGroupBy` or `changeGroupBy` — in development, this throws a descriptive error to catch the bug early; in production, the call is silently rejected and the previous grouping state is preserved.
- **A `custom` level's `getKey` throwing, or returning something other than `string | string[] | null | undefined`** — in development, this throws immediately. In production, the affected item(s) fall back to the Unknown bucket instead of crashing the whole computation, with a single console warning per grouping pass (not one per item, to avoid flooding the console on a large dataset).

### Duplicate Custom Level IDs

If two or more `custom` levels in the same grouping share an `id`, a warning is logged in development (never in production) — since a dev warning that references a level by `id` would otherwise be ambiguous about which one it means.

### Stable `data` and `activeGroupBy` References

The internal `useMemo` depends on `data` and the active grouping configuration maintaining stable references between renders. Passing an inline-mapped or filtered array directly (e.g. `data={source.map(x => x)}`) creates a new reference every render, defeating memoization and recomputing groups unnecessarily. Memoize `data` yourself (e.g. with `useMemo`) if it's derived from a transformation.

## See Also

- [useFilter](../useFilter/README.md) — filters a list based on one or more conditions, letting you narrow down a dataset before grouping it.
- [useSort](../useSort/README.md) — sorts items within a group, or sorts `groupedArray` itself into a specific order.
- [usePagination](../usePagination/README.md) — paginate a single group's `items`, or the flat `data` before grouping.
