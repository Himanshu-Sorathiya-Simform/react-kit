# useFilter

A strictly type-safe, headless React hook for declarative, configuration-driven filtering of in-memory data sets.

## Motivation (Why this hook?)

Most filtering logic in React applications ends up as a tangle of imperative `if` statements scattered across `useMemo` blocks — one for the search box, one for the category dropdown, one for the price range, and so on. Every new filter means touching the filtering function itself, and the logic becomes harder to reason about (and test) as it grows.

`useFilter` replaces that imperative sprawl with a single declarative configuration array. Instead of writing filtering logic, you describe it: each filter is a plain `FilterConfig` object with an `id`, a `field`, a `type`, an `operator`, and a `value`. The hook takes care of applying every active filter to your data set and recomputing the result whenever the configuration or data changes.

Key advantages:

- **Declarative over imperative.** Filters are data, not code. Add, remove, or toggle a filter by updating an object — no new branching logic required.
- **Dot-notation nested access.** Filtering on `user.profile.address.city` works out of the box, with no manual object traversal on your part.
- **Built-in strategies.** `text`, `number`, `boolean`, `date`, `select`, and `multiselect` filter types ship with a full set of common operators (`contains`, `between`, `intersects`, and more).
- **Escape hatch for anything else.** When a built-in strategy isn't enough, a `type: "custom"` filter lets you supply your own `compare` function with full access to the item, the filter value, and the raw item value.
- **Predictable with incomplete data.** Missing or unusable values are never silently treated as a match — see [Missing Data Always Excludes](#missing-data-always-excludes) below.

## Import Syntax

```tsx
// Preferred
import {
	useFilter,
	type UseFilterReturn,
	type FilterConfig,
} from "@himanshu-sorathiya/react-kit/state";
// Or
import {
	useFilter,
	type UseFilterReturn,
	type FilterConfig,
} from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

```tsx
import { useFilter, type FilterConfig } from "@himanshu-sorathiya/react-kit/state";

interface User {
	id: string;
	name: string;
}

const users: User[] = [
	{ id: "1", name: "Ada Lovelace" },
	{ id: "2", name: "Alan Turing" },
	{ id: "3", name: "Grace Hopper" },
];

function UserList() {
	const nameFilter: FilterConfig<User> = {
		id: "name",
		field: "name",
		type: "text",
		operator: "contains",
		value: "ada",
	};

	const { filteredItems, upsertFilter } = useFilter<User>(users, [
		nameFilter,
	]);

	return (
		<ul>
			{filteredItems.map((user) => (
				<li key={user.id}>{user.name}</li>
			))}
		</ul>
	);
}
```

## API Reference

### Parameters

| Parameter        | Type                  | Required | Description                                                                                         |
| ----------------- | ---------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `data`            | `T[]`                  | Yes      | The source array of items to filter. Should be a stable reference (see [Gotchas](#gotchas--edge-cases)). |
| `initialFilters`  | `FilterState<T>`       | No       | An array of `FilterConfig<T>` objects used as the starting filter state and as the target for `resetFilters`. Defaults to `[]`. |
| `options`         | `UseFilterOptions`     | No       | See [Options](#options) below. |

#### Options

| Property | Type      | Default | Description                                                                                                                                          |
| -------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defer`  | `boolean` | `false` | When `true`, the filtering recomputation is deferred (via React's `useDeferredValue`) so a rapid filter change — e.g. typing into a search box — doesn't block a more urgent update. `data` itself is never deferred, only `filters`. |

### Return Values

| Property / Method                        | Type                                                                        | Description                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `filteredItems`                            | `T[]`                                                                           | The subset of `data` that satisfies every active filter. Recomputed via `useMemo` when `data` or `filters` change. |
| `filters`                                   | `FilterState<T>`                                                                | The current array of filter configuration objects, including inactive ones.                                        |
| `activeFilterCount`                         | `number`                                                                        | Count of filters currently participating in filtering (`isActive !== false`).                                      |
| `hasActiveFilters`                          | `boolean`                                                                       | `activeFilterCount > 0` — handy for conditionally rendering a "Clear filters" button.                              |
| `upsertFilter(filter)`                      | `(filter: FilterConfig<T>) => void`                                             | Adds a new filter, or replaces the existing filter that shares its `id`.                                           |
| `removeFilter(id)`                          | `(id: string \| string[]) => void`                                              | Removes a single filter by `id`, or multiple filters by passing an array of ids.                                   |
| `clearFilters()`                            | `() => void`                                                                    | Removes every filter, resulting in an empty `filters` array (and `filteredItems` equal to `data`).                 |
| `resetFilters()`                            | `() => void`                                                                    | Restores `filters` to the value originally passed as `initialFilters` **at mount** — later changes to that argument on subsequent renders don't change what this restores. |
| `replaceFilters(filters)`                   | `(filters: FilterConfig<T>[]) => void`                                          | Overwrites the entire `filters` array with a new one.                                                              |
| `toggleFilter(filter)`                      | `(filter: FilterConfig<T>) => void`                                             | Toggles `isActive` for an existing filter with a matching `id`; adds the filter as active if it doesn't yet exist. |
| `updateFilterConfig(id, partialConfig)`     | `(id: string, partialConfig: FilterConfigUpdate<T>) => void`                    | Merges a partial config into the filter matching `id` (e.g. change `operator`, `value`, or `isActive` together). Rejected if the merge would produce a value incompatible with the filter's `type`/`operator` — see [Validation](#validation--dev-mode-errors). |
| `getFilter(id)`                             | `(id: string) => FilterConfig<T> \| undefined`                                  | Returns the full config for the filter matching `id`, or `undefined` if it doesn't exist.                          |
| `getFilterValue(id)`                        | `(id: string) => unknown`                                                       | Returns the current `value` of the filter matching `id`, or `undefined` if no such filter exists.                  |
| `updateFilterValue(id, value)`              | `(id: string, value: unknown) => void`                                          | Updates only the `value` of the filter matching `id`, leaving the rest of its configuration untouched. Same validation as `updateFilterConfig`. |
| `isFilterActive(id)`                        | `(id: string) => boolean`                                                       | Returns whether the filter matching `id` is currently active (a filter with no `isActive` set is treated as active). |

### Configuration Reference

Every filter is a `FilterConfig<T>` object built from a shared base (`id`, `field?`, `isActive?`) plus a `type`/`operator`/`value` combination that TypeScript will validate for you.

| `type`         | Available `operator` values                                       | `value` shape                          |
| --------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| `text`          | `contains`, `equals`, `startsWith`, `endsWith`, `notContains`         | `string`                                 |
| `number`        | `equals`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `between` | `number` (or `{ min: number; max: number }` for `between`) |
| `boolean`       | `equals`, `notEquals`                                                 | `boolean`                                |
| `date`          | `equals`, `before`, `after`, `between`                                | `string \| number \| Date` (or a `{ min; max }` object for `between`) |
| `select`        | `equals`, `notEquals`, `in`, `notIn`                                   | `string \| number` (or `(string \| number)[]` for `in`/`notIn`) |
| `multiselect`   | `in`, `notIn`, `intersects`                                           | `(string \| number)[]`                   |
| `custom`        | `custom`                                                              | `unknown` — interpreted entirely by your `compare` function |

Two additional per-filter options:

- **`caseSensitive`** (`boolean`, `text` filters only) — controls whether string comparisons ignore case. Defaults to `false` (case-insensitive). `select` deliberately has no equivalent: select values are enumerated tokens from a fixed set, not free-typed input that could differ only by case.
- **`dateGranularity`** (`"day" | "instant"`, `date` filters only) — `"day"` (the default) compares calendar dates and ignores time-of-day, so a filter for "today" matches every timestamp on today's date. `"instant"` compares exact milliseconds.

## Advanced Usage & Examples

### Dynamic Filter Updates

Wire `updateFilterValue` up to an input's `onChange` handler to drive a live search box without recreating the filter's `id`, `type`, or `operator` on every keystroke.

```tsx
import { useFilter, type FilterConfig } from "@himanshu-sorathiya/react-kit/state";

interface Product {
	id: string;
	name: string;
}

function ProductSearch({ products }: { products: Product[] }) {
	const searchFilter: FilterConfig<Product> = {
		id: "search",
		field: "name",
		type: "text",
		operator: "contains",
		value: "",
	};

	const { filteredItems, updateFilterValue } = useFilter<Product>(
		products,
		[searchFilter],
		{ defer: true },
	);

	return (
		<>
			<input
				type="text"
				onChange={(e) => updateFilterValue("search", e.target.value)}
				placeholder="Search products..."
			/>
			<ul>
				{filteredItems.map((product) => (
					<li key={product.id}>{product.name}</li>
				))}
			</ul>
		</>
	);
}
```

### Faceted Search with `select.in`

`select`'s `in`/`notIn` operators check a scalar field against a set of allowed values — the standard "status is Active OR Pending" checkbox-group pattern. This is distinct from `multiselect`, where it's the *item's own field* (e.g. `tags`) that's an array, not the filter value.

```tsx
import { useFilter, type FilterConfig } from "@himanshu-sorathiya/react-kit/state";

interface Order {
	id: string;
	status: "pending" | "active" | "shipped" | "cancelled";
}

function OrdersByStatus({ orders }: { orders: Order[] }) {
	const statusFilter: FilterConfig<Order> = {
		id: "status",
		type: "select",
		operator: "in",
		value: ["pending", "active"],
	};

	const { filteredItems } = useFilter<Order>(orders, [statusFilter]);

	return (
		<ul>
			{filteredItems.map((order) => (
				<li key={order.id}>{order.id}</li>
			))}
		</ul>
	);
}
```

### Custom Comparator

Use `type: "custom"` when your filtering logic doesn't map cleanly to a built-in strategy. The `compare` function receives the resolved item value, the raw filter `value`, and the full item, so it can reach beyond a single field.

```tsx
import { useFilter, type FilterConfig } from "@himanshu-sorathiya/react-kit/state";

interface Order {
	id: string;
	total: number;
	discountApplied: boolean;
}

function DiscountedHighValueOrders({ orders }: { orders: Order[] }) {
	const highValueDiscountFilter: FilterConfig<Order> = {
		id: "highValueDiscount",
		field: "total",
		type: "custom",
		operator: "custom",
		value: 100,
		compare: (itemValue, filterValue, item) =>
			(itemValue as number) >= (filterValue as number)
			&& item.discountApplied,
	};

	const { filteredItems } = useFilter<Order>(orders, [
		highValueDiscountFilter,
	]);

	return (
		<ul>
			{filteredItems.map((order) => (
				<li key={order.id}>{order.id}</li>
			))}
		</ul>
	);
}
```

## Real-World Use Cases

- E-commerce product grids with combined category, brand, and price-range filtering
- Data tables with independent, per-column filter controls
- CRM contact lists with advanced date-range search on "last contacted" or "created at"
- Project management boards filtered by assignee, status, and label combinations
- Inventory management systems filtering by stock level, warehouse, and SKU pattern
- Admin dashboards with multi-criteria user search (role, status, signup date)
- Job board listings filtered by location, salary range, and required skills (multiselect)
- Analytics dashboards where users toggle metric thresholds on and off
- Support ticket queues filtered by priority, assigned agent, and custom SLA logic
- Real estate listing pages with nested field filters (e.g. `location.city`, `details.bedrooms`)

## Gotchas & Edge Cases

### Data Stability

`filteredItems` is derived with `useMemo`, keyed on the `data` and `filters` references. If you pass an inline-mapped or newly-created array as `data` on every render (e.g. `data.filter(...)` or `[...data]` inline in JSX), the memo will never hit its cache and the full filter pass will re-run every render — costly for large data sets. Memoize `data` yourself (e.g. with `useMemo`) whenever it's derived rather than a stable reference from state or props.

### Case Sensitivity

`text` filters are case-insensitive by default. Set `caseSensitive: true` on a filter's config if you need exact-case matching for `contains`, `equals`, `startsWith`, `endsWith`, or `notContains`.

### Nested Fields

Dot-notation in `field` (e.g. `"user.profile.name"`) is resolved automatically — there's nothing extra to configure. If `field` is omitted, the filter's `id` is used as the path instead.

### `select` Uses Loose Type Comparison

`select`'s `equals`/`notEquals`/`in`/`notIn` compare values with loose (`==`) equality, so a numeric field (`status: 1`) still matches a string filter value (`"1"`) — the common case when a filter's value comes from an HTML `<select>` element, which always emits strings. `multiselect` does **not** do this — it requires an exact type match, since multiselect values typically originate from your own filter UI rather than a raw form control.

### Missing Data Always Excludes

Every built-in operator treats a missing or unusable value (`null`, `undefined`, a non-numeric string for a `number` filter, an unparseable value for a `date` filter, etc.) as **excluding** the item — including the "negative" operators. `notContains`, `notEquals`, and `notIn` do *not* include an item just because its value is missing; a row with no value for the filtered field is treated as "unknown," never as a confident non-match. If you need different behavior for missing data, a `type: "custom"` filter gives you full control.

### Validation & Dev-Mode Errors

Two independent validation points, with slightly different behavior:

- **A filter with an unrecognized `type`/`operator` combination, or a `custom` filter missing its `compare` function** — logged as a console warning in development, and excludes every item for that filter (in both development and production). This never throws, since it's caught during the memoized filtering computation itself.
- **`updateFilterConfig`/`updateFilterValue`, given an unknown `id`, or an update that would produce a value incompatible with the filter's `type`/`operator`** — in development, this throws a descriptive error to catch the bug early; in production, the update is silently ignored and the filter's previous state is preserved.

### Duplicate Filter IDs

If `initialFilters` or `replaceFilters` contains two filters sharing the same `id`, a warning is logged in development (never in production). Every id-based lookup (`getFilter`, `getFilterValue`, `isFilterActive`, `updateFilterConfig`, `updateFilterValue`) will only ever affect the first match.

## See Also

- [useSort](../useSort/README.md) — sorts the filtered result set produced by `useFilter`.
- [usePagination](../usePagination/README.md) — chunks the filtered list into navigable pages.
- [useGrouping](../useGrouping/README.md) — partitions the filtered list into groups by field, date bucket, or a custom key.
