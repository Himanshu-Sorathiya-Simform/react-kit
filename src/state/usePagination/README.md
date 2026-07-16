# usePagination

A lightweight, fully type-safe React hook for client-side pagination — slice any array into pages, navigate between them, and resize pages on the fly, all without touching index math yourself.

## Motivation (Why this hook?)

Pagination sounds simple until you actually build it by hand. You end up re-deriving the same handful of bugs in every project: off-by-one errors when computing `totalPages`, a stale `pageIndex` that points past the end of the array after a filter shrinks your dataset, or a "Next" button that's still clickable on the last page. `usePagination` solves this once, correctly, so you never have to think about it again.

Specifically, this hook gives you:

- **Automatic bounds checking.** `pageIndex` is continuously clamped to a valid range. You can never land on a page that doesn't exist — even if your underlying `data` array shrinks (say, after a filter is applied) or `pageSize` changes, the hook silently corrects the index for you.
- **Dynamic page size changes.** Call `changePageSize` at any time and the hook recalculates `totalPages` and re-clamps `pageIndex` in the same update, so your UI never flashes an invalid state.
- **Granular navigation methods.** Rather than exposing a single `setPageIndex`, you get purpose-built methods — `nextPage`, `previousPage`, `goToFirstPage`, `goToLastPage`, and `goToPage` — each with its own built-in guard rails.

The result: you describe *what* page you want to be on, and the hook guarantees you're always somewhere valid.

## Import Syntax

```tsx
// Preferred
import { usePagination, type UsePaginationReturn } from "@himanshu-sorathiya/react-kit/state";
// Or
import { usePagination, type UsePaginationReturn } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

```tsx
import { usePagination } from "@himanshu-sorathiya/react-kit/state";

interface Product {
	id: number;
	name: string;
}

const products: Product[] = [
	{ id: 1, name: "Keyboard" },
	{ id: 2, name: "Mouse" },
	{ id: 3, name: "Monitor" },
	{ id: 4, name: "Webcam" },
	{ id: 5, name: "Microphone" },
];

function ProductList() {
	const { pageItems, canPrevious, canNext, previousPage, nextPage } =
		usePagination<Product>(products, 2);

	return (
		<div>
			<ul>
				{pageItems.map((product) => (
					<li key={product.id}>{product.name}</li>
				))}
			</ul>

			<button onClick={previousPage} disabled={!canPrevious}>
				Previous
			</button>
			<button onClick={nextPage} disabled={!canNext}>
				Next
			</button>
		</div>
	);
}
```

## API Reference

### Parameters

| Parameter          | Type     | Required | Description                                                                 |
| ------------------ | -------- | -------- | ----------------------------------------------------------------------------- |
| `data`              | `T[]`    | Yes      | The full, unpaginated array of items to paginate.                            |
| `initialPageSize`   | `number` | Yes      | The number of items per page when the hook first mounts.                     |
| `initialPageIndex`  | `number` | No       | The zero-based page index to start on. Defaults to `0`.                      |

### Return Values

`usePagination<T>` returns an object of type `UsePaginationReturn<T>` with the following shape:

| Property          | Type                                | Description                                                                                                   |
| ----------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `pageItems`        | `T[]`                                | The slice of `data` corresponding to the current `pageIndex` and `pageSize`.                                   |
| `pageSize`         | `number`                             | The current number of items per page.                                                                          |
| `pageIndex`        | `number`                             | The current zero-based page index, always kept within valid bounds.                                            |
| `totalPages`       | `number`                             | The total number of pages available, given the current `data.length` and `pageSize`. Never less than `1`.      |
| `canPrevious`      | `boolean`                            | `true` if `pageIndex` is greater than `0` (i.e., there is a page to go back to).                                |
| `canNext`          | `boolean`                            | `true` if `pageIndex` is less than `totalPages - 1` (i.e., there is a page to advance to).                      |
| `nextPage()`         | `() => void`                         | Advances to the next page. No-op if already on the last page.                                                   |
| `previousPage()`     | `() => void`                         | Goes back to the previous page. No-op if already on the first page.                                             |
| `goToFirstPage()`    | `() => void`                         | Jumps directly to page index `0`.                                                                                |
| `goToLastPage()`     | `() => void`                         | Jumps directly to the final valid page index (`totalPages - 1`).                                                |
| `goToPage(newPageIndex)`         | `(newPageIndex: number) => void`     | Jumps to a specific page index. Silently ignored if `newPageIndex` is out of range or not a number.             |
| `changePageSize(newPageIndex)`   | `(newPageSize: number) => void`      | Updates `pageSize` and re-clamps `pageIndex` so it remains valid under the new size. Ignored if `newPageSize` isn't a positive number. |
| `resetPageIndex()`   | `() => void`                         | Resets `pageIndex` back to the original `initialPageIndex` (clamped to the current valid range).                |
| `resetPageSize()`    | `() => void`                         | Resets `pageSize` back to the original `initialPageSize`, re-clamping `pageIndex` accordingly.                  |
| `resetPagination()`  | `() => void`                         | Resets both `pageSize` and `pageIndex` back to their original initial values in one call.                        |

## Advanced Usage & Examples

### Dynamic Pagination Controls

A page-size selector combined with a "jump to page" input, both wired directly into the hook:

```tsx
import { useState } from "react";
import { usePagination } from "@himanshu-sorathiya/react-kit/state";

function DataTableControls({ data }: { data: string[] }) {
	const {
		pageItems,
		pageIndex,
		pageSize,
		totalPages,
		changePageSize,
		goToPage,
	} = usePagination<string>(data, 10);

	const [jumpValue, setJumpValue] = useState("");

	return (
		<div>
			<ul>
				{pageItems.map((item, i) => (
					<li key={i}>{item}</li>
				))}
			</ul>

			<select
				value={pageSize}
				onChange={(e) => changePageSize(Number(e.target.value))}
			>
				<option value={5}>5 per page</option>
				<option value={10}>10 per page</option>
				<option value={25}>25 per page</option>
			</select>

			<span>
				Page {pageIndex + 1} of {totalPages}
			</span>

			<input
				value={jumpValue}
				onChange={(e) => setJumpValue(e.target.value)}
				placeholder="Go to page"
			/>
			<button onClick={() => goToPage(Number(jumpValue) - 1)}>Go</button>
		</div>
	);
}
```

### Boundary Management

Use `canPrevious` and `canNext` to keep your navigation buttons honest — no manual index comparisons required:

```tsx
import { usePagination } from "@himanshu-sorathiya/react-kit/state";

function BoundaryAwareControls({ data }: { data: number[] }) {
	const { canPrevious, canNext, previousPage, nextPage, goToFirstPage, goToLastPage } =
		usePagination<number>(data, 8);

	return (
		<div>
			<button onClick={goToFirstPage} disabled={!canPrevious}>
				First
			</button>
			<button onClick={previousPage} disabled={!canPrevious}>
				Prev
			</button>
			<button onClick={nextPage} disabled={!canNext}>
				Next
			</button>
			<button onClick={goToLastPage} disabled={!canNext}>
				Last
			</button>
		</div>
	);
}
```

## Real-World Use Cases

- Large admin data tables with thousands of rows
- Product catalog and search-result grids in e-commerce apps
- Transaction and order history lists in finance dashboards
- Forum or comment thread pagination
- Paginated API result viewers and dashboards
- Task and ticket management board list views
- Notification center feeds
- Log and audit trail viewers
- Media galleries (photos, videos, documents)
- Contact or user directory listings

## Gotchas & Edge Cases

### `data` Stability

Avoid passing an inline, freshly-created array directly into the hook, such as `usePagination(list.map(fn), 10)`. Since `list.map(...)` produces a brand-new array reference on every render, the internal `useMemo` that computes `pageItems` will see a changed dependency each time and recalculate unnecessarily — even if the underlying data hasn't actually changed.

Instead, memoize the derived array yourself (e.g., with `useMemo`) or keep it in state, and pass that stable reference into `usePagination`:

```tsx
// ❌ Avoid: creates a new array reference on every render
const { pageItems } = usePagination(list.map((item) => item.value), 10);

// ✅ Prefer: a stable, memoized reference
const mappedList = useMemo(() => list.map((item) => item.value), [list]);
const { pageItems } = usePagination(mappedList, 10);
```

### Automatic Bounds Checking

You don't need to manually guard against an invalid `pageIndex`. If your `data` array shrinks — for example, after the user applies a filter and fewer items remain — the hook automatically recalculates `totalPages` and adjusts `pageIndex` down into the new valid range on the very next render. This means you'll never end up rendering an empty page or hitting an out-of-bounds slice, even when your data source changes shape out from under the hook.

## See Also

- [useSort](../useSort/README.md) — Sort arrays by key, direction, or custom comparator.
- [useFilter](../useFilter/README.md) — Declaratively filter arrays based on one or more predicates.
- [useOrder](../useOrder/README.md) — Manage and persist custom item ordering, including drag-and-drop reordering.
