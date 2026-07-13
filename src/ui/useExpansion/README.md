# useExpansion

A lightweight, fully type-safe React hook for managing expand/collapse state — accordions, tree views, expandable table rows, and multi-panel layouts — without hand-rolling `Set` or array logic yourself.

## Motivation (Why this hook?)

Expansion state looks trivial until you actually build it. You start with a `string[]` or a `Set<string>`, then you're writing the same `has` / `add` / `delete` boilerplate in every component, manually branching between "only one thing open at a time" and "anything can be open," and re-deriving the expanded items from your source data on every interaction.

`useExpansion` collapses all of that into a single, predictable API:

- **One boolean controls the mode.** Flip `multiple` between `true` and `false` to switch instantly between strict accordion behavior (single-expansion) and free-form tree/panel behavior (multi-expansion) — no branching logic in your components.
- **Works with primitives or objects.** Pass raw IDs (`string | number`) for simple independent toggles, or pass full objects together with a `field` and let the hook resolve the identifier via dot-notation for you.
- **Rich, purpose-built API.** Beyond basic `toggle`/`expand`/`collapse`, you get bulk operations (`expandAll`, `collapseAll`), a way to snap back to your original state (`resetExpansion`), and a way to programmatically set expansion from external state (`replaceExpansion`) — so you're not reimplementing these one-off utilities in every feature that needs an expand/collapse pattern.
- **Derived data included.** `expandedItems` is computed for you, so you never manually filter your source array against a list of expanded IDs.

## Import Syntax

```tsx
import { useExpansion, type UseExpansionReturn } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

The simplest way to use `useExpansion` is in **ID-only mode** — no `items` array required. This is ideal for toggling independent UI sections that don't map to a data collection.

```tsx
import { useExpansion } from "@himanshu-sorathiya/react-kit";

function FaqAccordion() {
	const { isExpanded, toggle } = useExpansion();

	return (
		<div>
			<button onClick={() => toggle("section-1")}>
				{isExpanded("section-1") ? "Hide" : "Show"} Section 1
			</button>
			{isExpanded("section-1") && <p>Content for section 1.</p>}

			<button onClick={() => toggle("section-2")}>
				{isExpanded("section-2") ? "Hide" : "Show"} Section 2
			</button>
			{isExpanded("section-2") && <p>Content for section 2.</p>}
		</div>
	);
}
```

By default `multiple` is `false`, so toggling `section-2` open will automatically close `section-1` — perfect for strict accordion behavior. Set `multiple: true` to allow both to stay open simultaneously.

## API Reference

### Parameters

`useExpansion` accepts a single, optional configuration object:

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `items` | `T[]` | No | `[]` | The source collection to derive `expandedItems` from and to power `expandAll`. Not required for ID-only usage. |
| `field` | `string` | No | `undefined` | Dot-notation path used to extract the identifier from each item (e.g. `"id"` or `"meta.uuid"`). Omit when working with primitive IDs directly. |
| `initialExpandedIds` | `ExpansionId[]` | No | `[]` | IDs that should be expanded on mount, and the state `resetExpansion()` restores. |
| `multiple` | `boolean` | No | `false` | When `false`, expanding an item collapses any other expanded item (accordion mode). When `true`, any number of items can be expanded simultaneously. |

> `ExpansionId` is `string | number`.

### Return Values

| Property | Type / Signature | Description |
| --- | --- | --- |
| `expandedIds` | `ExpansionId[]` | The currently expanded IDs as a plain array. A **new array reference** is produced on every render (see [Gotchas](#gotchas--edge-cases)). |
| `expandedItems` | `T[]` | The subset of `items` whose resolved ID is currently expanded. Memoized against `items`, `field`, and `expandedIds`. |
| `isExpanded(itemOrId)` | `(itemOrId: ExpansionId \| T) => boolean` | Returns whether the given item (or raw ID) is currently expanded. |
| `expand(itemOrId)` | `(itemOrId: ExpansionId \| T) => void` | Expands the given item/ID. In single mode (`multiple: false`), this replaces any currently expanded item. |
| `collapse(itemOrId)` | `(itemOrId: ExpansionId \| T) => void` | Collapses the given item/ID, regardless of mode. |
| `toggle(itemOrId)` | `(itemOrId: ExpansionId \| T) => void` | Toggles the given item/ID. In single mode, toggling an already-expanded item collapses it (and results in nothing expanded); toggling a new item replaces the current selection. |
| `expandAll()` | `() => void` | Expands every item in `items`. **No-op when `multiple` is `false`** — see [Gotchas](#gotchas--edge-cases). |
| `collapseAll()` | `() => void` | Clears all expanded IDs. |
| `resetExpansion()` | `() => void` | Restores expansion state to the `initialExpandedIds` value provided when the hook first mounted. |
| `replaceExpansion(newExpandedItems)` | `(newExpandedItems: ExpansionId[] \| T[]) => void` | Discards the current expanded set entirely and replaces it with the resolved ids from `newExpandedItems`., bypassing `expand`/`collapse`/`toggle` logic entirely. |

Every argument typed `itemOrId: ExpansionId | T` accepts either a raw ID (`string`/`number`) or a full item object — the hook resolves the correct ID internally using `field` when an object is passed.

## Advanced Usage & Examples

### Multi-Expansion with Objects

When working with a data collection, pass `items` alongside `field` so the hook can resolve IDs from your objects automatically. Combine this with `multiple: true` to build tree views, expandable table rows, or multi-panel layouts where several entries can be open at once.

```tsx
import { useExpansion } from "@himanshu-sorathiya/react-kit";

interface Order {
	id: string;
	customer: string;
	total: number;
}

const orders: Order[] = [
	{ id: "ord-1", customer: "Aarav Shah", total: 1200 },
	{ id: "ord-2", customer: "Priya Mehta", total: 850 },
	{ id: "ord-3", customer: "Rohan Iyer", total: 430 },
];

function OrdersTable() {
	const { isExpanded, toggle, expandAll, collapseAll, expandedItems } = useExpansion<Order>({
		items: orders,
		field: "id",
		multiple: true,
	});

	return (
		<div>
			<button onClick={expandAll}>Expand All</button>
			<button onClick={collapseAll}>Collapse All</button>
			<p>{expandedItems.length} order(s) expanded</p>

			<table>
				<tbody>
					{orders.map((order) => (
						<tr key={order.id}>
							<td>{order.customer}</td>
							<td>
								<button onClick={() => toggle(order)}>
									{isExpanded(order) ? "Collapse" : "Expand"}
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
```

Note that `toggle`, `isExpanded`, and `collapse` all accept the full `order` object directly — you don't need to manually pull out `order.id` yourself; the hook does that internally via the `field` you configured.

## Real-World Use Cases

- Strict, single-expansion FAQ accordions
- Expandable data table rows showing row-level detail
- Nested file/folder tree views with multiple open branches
- Multi-section settings or preferences panels
- Collapsible sidebar navigation groups
- "Read more" style content sections on a page
- Master-detail list layouts where selecting an item reveals inline details
- Grouped notification or activity feeds with collapsible clusters
- Step-by-step wizard summaries where completed steps collapse
- Product detail pages with collapsible spec/description/review sections

## Gotchas & Edge Cases

### The `expandAll` Guard

`expandAll()` is intentionally a **no-op when `multiple` is `false`**. In single-expansion mode, expanding "all" items would contradict the accordion contract, so the hook silently returns without changing state. If bulk-expand isn't working as expected, double-check that `multiple: true` is set.

### `expandedIds` Reference Issue

`expandedIds` is computed as `[...expandedIds]` on **every render**, which means it is a brand-new array reference each time, even if its contents haven't changed. Avoid using it directly as a `useEffect` dependency:

```tsx
// ❌ Avoid — new array reference every render can cause repeated effect runs
useEffect(() => {
	doSomething();
}, [expandedIds]);

// ✅ Prefer a stable, derived primitive
useEffect(() => {
	doSomething();
}, [expandedIds.length]);

// ✅ Or, if order/content matters, stringify it
useEffect(() => {
	doSomething();
}, [JSON.stringify(expandedIds)]);
```

### Stable `items` Reference

`expandedItems` is computed with `useMemo`, keyed on the `items` reference (plus `field` and `expandedIds`). Passing a freshly mapped/filtered array inline will produce a new reference on every render, defeating the memoization:

```tsx
// ❌ Avoid — creates a new array every render, breaking the useMemo
const { expandedItems } = useExpansion({
	items: data.map((d) => ({ id: d.id, label: d.name })),
	field: "id",
});

// ✅ Prefer — memoize the derived array yourself before passing it in
const items = useMemo(() => data.map((d) => ({ id: d.id, label: d.name })), [data]);
const { expandedItems } = useExpansion({ items, field: "id" });
```

## See Also

- **[useSingleSelection](../../state/useSingleSelection/README.md)** — Manages "which one item is currently selected" state. Where `useExpansion` tracks *what's open*, `useSingleSelection` tracks *what's chosen*.
- **[useMultipleSelection](../../state//useMultipleSelection/README.md)** — The multi-item counterpart to `useSingleSelection`, for tracking a set of selected items rather than expanded ones.
- **[useVisibility](../useVisibility/README.md)** — A simpler primitive for a single element's true/false visibility toggle, without the multi-ID or item-resolution logic `useExpansion` provides.
