# useExpansion

A lightweight, fully type-safe React hook for managing expand/collapse state — accordions, tree views, expandable table rows, and multi-panel layouts — without hand-rolling `Set` or array logic yourself.

## Motivation (Why this hook?)

Expansion state looks trivial until you actually build it. You start with a `string[]` or a `Set<string>`, then you're writing the same `has` / `add` / `delete` boilerplate in every component, manually branching between "only one thing open at a time" and "anything can be open," and re-deriving the expanded items from your source data on every interaction.

`useExpansion` collapses all of that into a single, predictable API:

- **One boolean controls the mode.** Flip `multiple` between `true` and `false` to switch instantly between strict accordion behavior (single-expansion) and free-form tree/panel behavior (multi-expansion) — no branching logic in your components.
- **Tabs-style mode, too.** In single mode, `collapsible` decides whether the one open item can be closed entirely, or whether exactly one item must always stay expanded.
- **Works with primitives or objects.** Pass raw IDs (`string | number`) for simple independent toggles, or pass full objects together with a `field` and let the hook resolve the identifier via dot-notation for you.
- **Compile-time safety for object mode.** Try to pass an object item without configuring `field`? TypeScript won't let you build — this is caught before you ever run the code, not at runtime.
- **Rich, purpose-built API.** Beyond basic `toggleExpansion`/`expand`/`collapse`, you get bulk operations (`expandAll`, `collapseAll` — both scopeable to a subset), a way to snap back to your original state (`resetExpansion`), and a way to programmatically set expansion from external state (`replaceExpansion`).
- **Derived data included.** `expandedItems`/`collapsedItems` are computed for you, so you never manually filter your source array against a list of expanded IDs.

## Import Syntax

```tsx
// Preferred
import { useExpansion, type UseExpansionReturn } from "@himanshu-sorathiya/react-kit/state";
// Or
import { useExpansion, type UseExpansionReturn } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

The simplest way to use `useExpansion` is in **ID-only mode** — no `items` array required. This is ideal for toggling independent UI sections that don't map to a data collection.

```tsx
import { useExpansion } from "@himanshu-sorathiya/react-kit/state";

function FaqAccordion() {
	const { isExpanded, toggleExpansion } = useExpansion();

	return (
		<div>
			<button onClick={() => toggleExpansion("section-1")}>
				{isExpanded("section-1") ? "Hide" : "Show"} Section 1
			</button>
			{isExpanded("section-1") && <p>Content for section 1.</p>}

			<button onClick={() => toggleExpansion("section-2")}>
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
|---|---|---|---|---|
| `items` | `T[]` | Conditional | `[]` | The source collection to derive `expandedItems`/`collapsedItems` from, and the default target for `expandAll()` when it's called with no argument. **Required in object mode** (alongside `field`); optional for id-only usage. |
| `field` | `string` | Conditional | `undefined` | Dot-notation path used to extract the identifier from each item (e.g. `"id"` or `"meta.uuid"`). **Required when `items` is an array of objects**; **must be omitted** for id-only usage — TypeScript will flag it if included there. |
| `initialExpandedIds` | `ExpansionId[]` | No | `[]` | IDs that should be expanded on mount, and the state `resetExpansion()` restores. Truncated to just the first (with a dev-mode warning) if `multiple` is `false` and more than one is given. |
| `multiple` | `boolean` | No | `false` | When `false`, expanding an item collapses any other expanded item (accordion mode). When `true`, any number of items can be expanded simultaneously. |
| `collapsible` | `boolean` | No | `true` | Single mode only (ignored when `multiple` is `true`). Whether the one expanded item can be collapsed back down to nothing via `collapse`/`toggleExpansion`. See [Gotchas](../../../README.md#collapsible-only-gates-the-interactive-close). |

> `ExpansionId` is `string | number`.

### Return Values

| Property | Type / Signature | Description |
|---|---|---|
| `expandedIds` | `readonly ExpansionId[]` | The currently expanded IDs. Memoized — stable across renders when the expanded set hasn't changed. |
| `expandedItems` | `readonly T[]` | The subset of `items` whose resolved ID is currently expanded. |
| `collapsedItems` | `readonly T[]` | The subset of `items` whose resolved ID is **not** currently expanded. |
| `expandedCount` | `number` | `expandedIds.length`. |
| `hasExpanded` | `boolean` | `true` if anything at all is expanded. |
| `isExpanded(itemOrId)` | `(itemOrId: ExpansionId \| T) => boolean` | Returns whether the given item (or raw ID) is currently expanded. |
| `expand(itemOrId)` | `(itemOrId: ExpansionId \| T) => void` | Expands the given item/ID. In single mode, this also collapses whatever was previously expanded. |
| `collapse(itemOrId)` | `(itemOrId: ExpansionId \| T) => void` | Collapses the given item/ID. No-ops if it isn't expanded, or (in single mode) if `collapsible` is `false`. |
| `toggleExpansion(itemOrId)` | `(itemOrId: ExpansionId \| T) => void` | Expands the given item/ID if collapsed, collapses it if expanded — subject to the same single-mode/`collapsible` rules as `expand`/`collapse`. |
| `expandAll(itemsArray?)` | `(itemsArray?: ExpansionId[] \| T[]) => void` | Expands every id/item given, or every item in `items` if called with no argument. **No-op (with a dev-mode warning) when `multiple` is `false`.** |
| `collapseAll(itemsArray?)` | `(itemsArray?: ExpansionId[] \| T[]) => void` | Collapses every id/item given, or **collapses everything** if called with no argument — not gated by `multiple`. |
| `resetExpansion()` | `() => void` | Restores expansion state to the `initialExpandedIds` value provided when the hook first mounted, re-checked against the *current* `multiple` value. |
| `replaceExpansion(newExpandedItems)` | `(newExpandedItems: ExpansionId[] \| T[]) => void` | Replaces the current expanded set entirely with the resolved IDs from `newExpandedItems`, truncated to just the first if `multiple` is `false` and more than one is given. |

Every argument typed `itemOrId: ExpansionId | T` accepts either a raw ID or a full item object — the hook resolves the correct ID internally using `field` when an object is passed.

## Advanced Usage & Examples

### Multi-Expansion with Objects

When working with a data collection, pass `items` alongside `field` so the hook can resolve IDs from your objects automatically. Combine this with `multiple: true` to build tree views, expandable table rows, or multi-panel layouts where several entries can be open at once.

```tsx
import { useExpansion } from "@himanshu-sorathiya/react-kit/state";

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
	const { isExpanded, toggleExpansion, expandAll, collapseAll, expandedItems } =
		useExpansion<Order>({ items: orders, field: "id", multiple: true });

	return (
		<div>
			<button onClick={() => expandAll()}>Expand All</button>
			<button onClick={() => collapseAll()}>Collapse All</button>
			<p>{expandedItems.length} order(s) expanded</p>

			<table>
				<tbody>
					{orders.map((order) => (
						<tr key={order.id}>
							<td>{order.customer}</td>
							<td>
								<button onClick={() => toggleExpansion(order)}>
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

Note that `toggleExpansion`, `isExpanded`, and `collapse` all accept the full `order` object directly — you don't need to manually pull out `order.id` yourself.

### Tabs-Style Accordion (`collapsible: false`)

By default, single mode lets you close the one open item, ending with nothing expanded. Set `collapsible: false` to require exactly one item to always stay open — clicking the currently-open item again simply does nothing:

```tsx
import { useExpansion } from "@himanshu-sorathiya/react-kit/state";

const sections = ["Overview", "Pricing", "FAQ"];

function TabsLikeAccordion() {
	const { isExpanded, toggleExpansion } = useExpansion({
		initialExpandedIds: ["Overview"],
		collapsible: false,
	});

	return (
		<div>
			{sections.map((section) => (
				<button key={section} onClick={() => toggleExpansion(section)}>
					{section} {isExpanded(section) ? "(open)" : ""}
				</button>
			))}
		</div>
	);
}
```

## Real-World Use Cases

- Strict, single-expansion FAQ accordions
- Tab-like navigation, where exactly one panel is always visible
- Expandable data table rows showing row-level detail
- Nested file/folder tree views with multiple open branches
- Multi-section settings or preferences panels
- Collapsible sidebar navigation groups
- "Read more" style content sections on a page
- Master-detail list layouts where selecting an item reveals inline details
- Grouped notification or activity feeds with collapsible clusters
- Product detail pages with collapsible spec/description/review sections

## Gotchas & Edge Cases

### The `expandAll` Guard

`expandAll()` is intentionally a **no-op when `multiple` is `false`**, logging a dev-mode warning when it's called that way. In single-expansion mode, expanding "all" items would contradict the accordion contract, so the hook doesn't touch state. If bulk-expand isn't working as expected, double-check that `multiple: true` is set.

### `collapsible` Only Gates the Interactive Close

`collapsible: false` specifically blocks `collapse`/`toggleExpansion` from closing the one expanded item down to nothing. It does **not** block `collapseAll()` or `replaceExpansion([])` — those are explicit, deliberate "set state directly" calls, and are always honored regardless of `collapsible`. If you want to guarantee something is always expanded no matter what, don't call those two with an empty result while `collapsible: false` is set.

### Single-Mode Truncation

Any attempt to seed or replace the expanded set with more than one ID while `multiple` is `false` — via `initialExpandedIds`, `resetExpansion()`, or `replaceExpansion()` — keeps only the first ID and logs a dev-mode warning about the rest. `expand`/`toggleExpansion` never run into this, since they only ever add one ID at a time by construction.

### Stable References

`expandedIds` is memoized — it only changes reference when the expanded set actually changes, so it's safe to use directly in dependency arrays. `expandedItems`/`collapsedItems` are memoized against `items`, `field`, and the expanded set — a freshly mapped/filtered array passed inline as `items` creates a new reference every render and defeats that memoization:

```tsx
//  Avoid — creates a new array every render, breaking the memoization
const { expandedItems } = useExpansion({
	items: data.map((d) => ({ id: d.id, label: d.name })),
	field: "id",
});

//  Prefer — memoize the derived array yourself before passing it in
const items = useMemo(() => data.map((d) => ({ id: d.id, label: d.name })), [data]);
const { expandedItems } = useExpansion({ items, field: "id" });
```

## See Also

- **[useOrder](../../../../useOrder/README.md)** — manages the sequence and ranking of items within a list.
- **[usePin](../../../../usePin/README.md)** — manages a pinned/favorited subset of a list, independent of expansion.
- **[useVisibility](../../../../useVisibility/README.md)** — a simpler primitive for show/hide state, without the single/multiple-expansion logic `useExpansion` provides.
