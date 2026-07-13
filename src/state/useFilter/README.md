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

## Import Syntax

```tsx
import {
	useFilter,
	type UseFilterReturn,
	type FilterConfig,
} from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

```tsx
import { useFilter, type FilterConfig } from "@himanshu-sorathiya/react-kit";

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

### Return Values

| Property / Method    | Type                                                                 | Description                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `filteredItems`        | `T[]`                                                                   | The subset of `data` that satisfies every active filter. Recomputed via `useMemo` when `data` or `filters` change. |
| `filters`               | `FilterState<T>`                                                        | The current array of filter configuration objects, including inactive ones.                                        |
| `upsertFilter(filter)`          | `(filter: FilterConfig<T>) => void`                                     | Adds a new filter, or replaces the existing filter that shares its `id`.                                           |
| `removeFilter(id)`          | `(id: string \| string[]) => void`                                      | Removes a single filter by `id`, or multiple filters by passing an array of ids.                                   |
| `clearFilters()`          | `() => void`                                                            | Removes every filter, resulting in an empty `filters` array (and `filteredItems` equal to `data`).                 |
| `resetFilters()`          | `() => void`                                                            | Restores `filters` to the value originally passed as `initialFilters`.                                             |
| `replaceFilters(filters)`        | `(filters: FilterConfig<T>[]) => void`                                  | Overwrites the entire `filters` array with a new one.                                                              |
| `toggleFilter(filter)`          | `(filter: FilterConfig<T>) => void`                                     | Toggles `isActive` for an existing filter with a matching `id`; adds the filter as active if it doesn't yet exist. |
| `updateFilterConfig(id, partialConfig)`    | `(id: string, partialConfig: Partial<Omit<FilterConfig<T>, "id">>) => void` | Merges a partial config into the filter matching `id` (e.g. change `operator`, `value`, or `isActive` together).   |
| `getFilterValue(id)`        | `(id: string) => unknown`                                              | Returns the current `value` of the filter matching `id`, or `undefined` if no such filter exists.                  |
| `updateFilterValue(id)`     | `(id: string, value: unknown) => void`                                  | Updates only the `value` of the filter matching `id`, leaving the rest of its configuration untouched.              |
| `isFilterActive(id)`        | `(id: string) => boolean`                                              | Returns whether the filter matching `id` is currently active (a filter with no `isActive` set is treated as active). |

### Configuration Reference

Every filter is a `FilterConfig<T>` object built from a shared base (`id`, `field`, `isActive?`, `caseSensitive?`, `compare?`) plus a `type`/`operator`/`value` combination that TypeScript will validate for you.

| `type`         | Available `operator` values                                       | `value` shape                          |
| --------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| `text`          | `contains`, `equals`, `startsWith`, `endsWith`, `notContains`         | `string`                                 |
| `number`        | `equals`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `between` | `number` (or `{ min: number; max: number }` for `between`) |
| `boolean`       | `equals`                                                              | `boolean`                                |
| `date`          | `equals`, `before`, `after`, `between`                                | `string \| number \| Date` (or a `{ min; max }` object for `between`) |
| `select`        | `equals`, `notEquals`                                                 | `string \| number`                       |
| `multiselect`   | `in`, `notIn`, `intersects`                                           | `(string \| number)[]`                   |
| `custom`        | `custom`                                                              | `unknown` — interpreted entirely by your `compare` function |

For `text` filters, an optional `caseSensitive` flag controls whether string comparisons ignore case (the default is case-insensitive).

## Advanced Usage & Examples

### Dynamic Filter Updates

Wire `updateFilterValue` up to an input's `onChange` handler to drive a live search box without recreating the filter's `id`, `type`, or `operator` on every keystroke.

```tsx
import { useFilter, type FilterConfig } from "@himanshu-sorathiya/react-kit";

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

	const { filteredItems, updateFilterValue } = useFilter<Product>(products, [
		searchFilter,
	]);

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

### Custom Comparator

Use `type: "custom"` when your filtering logic doesn't map cleanly to a built-in strategy. The `compare` function receives the resolved item value, the raw filter `value`, and the full item, so it can reach beyond a single field.

```tsx
import { useFilter, type FilterConfig } from "@himanshu-sorathiya/react-kit";

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

- **Data Stability:** `filteredItems` is derived with `useMemo`, keyed on the `data` and `filters` references. If you pass an inline-mapped or newly-created array as `data` on every render (e.g. `data.filter(...)` or `[...data]` inline in JSX), the memo will never hit its cache and the full filter pass will re-run every render — costly for large data sets. Memoize `data` yourself (e.g. with `useMemo`) whenever it's derived rather than a stable reference from state or props.
- **Case Sensitivity:** `text` filters are case-insensitive by default. Set `caseSensitive: true` on a filter's config if you need exact-case matching for `contains`, `equals`, `startsWith`, `endsWith`, or `notContains`.
- **Nested Fields:** Dot-notation in `field` (e.g. `"user.profile.name"`) is resolved automatically — there's nothing extra to configure. If `field` is omitted, the filter's `id` is used as the path instead.

## See Also

- [useSort](../useSort/README.md) — sorts the filtered result set produced by `useFilter`.
- [useOrder](../useOrder/README.md) — manages the explicit, user-controlled display sequence of items.
- [usePagination](../usePagination/README.md) — chunks the filtered list into navigable pages.
- [useSingleSelection](../useSingleSelection/README.md) — manages single-item selection state over a list.
