# useVisibility

A lightweight, fully type-safe React hook for managing show/hide (visibility) state across any collection of items — primitives or complex objects — without hand-rolling `Set` or array logic yourself.

## Motivation (Why this hook?)

Toggling visibility for a list of things sounds trivial until you actually build it: you end up writing the same `Set`-mutation boilerplate — clone the set, add or delete an id, sync it back into state — over and over, once per feature. `useVisibility` collapses all of that into a single hook.

What makes it worth reaching for instead of rolling your own:

- **Works with primitives and objects alike.** Pass an array of strings or numbers and toggle them directly, or pass an array of objects and tell the hook which key identifies each item — including deeply nested keys via dot-notation (e.g. `"user.id"` or `"metadata.id"`).
- **Compile-time safety for object mode.** Try to pass an object item without configuring `field`? TypeScript won't let you build — this is caught before you ever run the code, not at runtime.
- **No manual `Set` juggling.** `show`, `hide`, `toggleVisibility`, `showAll`, and `hideAll` all handle the underlying `Set` mutations internally and expose a plain, memoized array (`visibleIds`) for easy consumption.
- **Automatic, memoized partitioning.** You never have to `.filter()` your data yourself — `visibleItems` and `hiddenItems` are derived and memoized for you, recomputing only when `items`, `field`, or the visibility state actually changes.
- **Predictable resets and bulk replacement.** `resetVisibility` snaps back to whatever `initialVisibleIds` you started with, and `replaceVisibility` lets you swap the entire visible set in one call — handy for syncing visibility from an external source (like a saved user preference).

In short: less boilerplate, fewer footguns, and a single consistent API whether you're toggling a badge, a table row, or an entire panel.

## Import Syntax

```tsx
// Preferred
import { useVisibility, type UseVisibilityReturn } from "@himanshu-sorathiya/react-kit/state";
// Or
import { useVisibility, type UseVisibilityReturn } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

A minimal example using a primitive array of tags. Since the items are primitives, `field` is not required — the values themselves act as the identifiers.

```tsx
import { useVisibility } from "@himanshu-sorathiya/react-kit/state";

const tags = ["react", "typescript", "hooks", "vite"];

function TagList() {
	const { visibleItems, isVisible, toggleVisibility } = useVisibility({ items: tags });

	return (
		<ul>
			{tags.map((tag) => (
				<li key={tag}>
					<button onClick={() => toggleVisibility(tag)}>
						{isVisible(tag) ? "Hide" : "Show"} {tag}
					</button>
				</li>
			))}
			<li>Visible tags: {visibleItems.join(", ")}</li>
		</ul>
	);
}
```

## API Reference

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `items` | `T[]` | Conditional | The full source array the hook operates on, and the default target for `showAll()` when it's called with no argument. **Required in object mode** (alongside `field`); optional for id-only usage. |
| `field` | `string` | Conditional | The key used to identify each item. **Required when `items` is an array of objects** — supports dot-notation for nested keys (e.g. `"metadata.id"`). **Must be omitted** for id-only usage; TypeScript will flag it if included there. |
| `initialVisibleIds` | `VisibilityId[]` (`(number \| string)[]`) | No | The set of ids that should be visible when the hook first mounts. Defaults to `[]` (nothing visible). Also the value `resetVisibility()` restores. |

> `VisibilityId` is defined as `string | number`.

### Return Values

| Property / Method | Type | Description |
|---|---|---|
| `visibleIds` | `readonly VisibilityId[]` | Every currently visible id. Memoized — stable across renders when the visible set hasn't changed. |
| `visibleItems` | `readonly T[]` | The subset of `items` whose resolved id is currently visible. |
| `hiddenItems` | `readonly T[]` | The subset of `items` whose resolved id is currently **not** visible. |
| `visibleCount` | `number` | The number of currently visible ids. |
| `hiddenCount` | `number` | `hiddenItems.length`. |
| `hasVisible` | `boolean` | `true` if anything at all is visible. |
| `isVisible(itemOrId)` | `(itemOrId: VisibilityId \| T) => boolean` | Accepts either a raw id or a full item; returns whether it's currently visible. |
| `show(itemOrId)` | `(itemOrId: VisibilityId \| T) => void` | Adds the resolved id to the visible set. No-op if it's already visible. |
| `hide(itemOrId)` | `(itemOrId: VisibilityId \| T) => void` | Removes the resolved id from the visible set. No-op if it's already hidden. |
| `toggleVisibility(itemOrId)` | `(itemOrId: VisibilityId \| T) => void` | Flips the resolved id's visibility. |
| `showAll(itemsArray?)` | `(itemsArray?: VisibilityId[] \| T[]) => void` | Adds every resolved id from `itemsArray` (or from `items` if omitted) to the visible set, preserving whatever was already visible. |
| `hideAll(itemsArray?)` | `(itemsArray?: VisibilityId[] \| T[]) => void` | Removes every resolved id from `itemsArray` — or **removes everything**, regardless of `items`, if called with no argument. See [Gotchas](../../../README.md#showall-vs-hideall-with-no-argument). |
| `resetVisibility()` | `() => void` | Resets the visible set back to the `initialVisibleIds` value the hook was initialized with. |
| `replaceVisibility(newVisibleItems)` | `(newVisibleItems: VisibilityId[] \| T[]) => void` | Discards the current visible set entirely and replaces it with the resolved ids from `newVisibleItems`. |

## Advanced Usage & Examples

### Object Array with Nested Keys (Dot-Notation)

When your data is an array of objects, `field` is required. It supports dot-notation, so you can point directly at a nested identifier without flattening your data first — perfect for tracking visibility of specific rows in a list or table.

```tsx
import { useVisibility } from "@himanshu-sorathiya/react-kit/state";

interface Row {
	user: { id: string; name: string };
}

const rows: Row[] = [
	{ user: { id: "u1", name: "Ada Lovelace" } },
	{ user: { id: "u2", name: "Alan Turing" } },
	{ user: { id: "u3", name: "Grace Hopper" } },
];

function UserTable() {
	const { isVisible, toggleVisibility, visibleItems } = useVisibility({
		items: rows,
		field: "user.id",
	});

	return (
		<table>
			<tbody>
				{rows.map((row) => (
					<tr key={row.user.id}>
						<td>{row.user.name}</td>
						<td>
							<button onClick={() => toggleVisibility(row)}>
								{isVisible(row) ? "Hide" : "Show"}
							</button>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
```

### Bulk Actions (Show All / Hide All)

`showAll` and `hideAll` make "Select All" / "Deselect All" controls trivial — no manual iteration required.

```tsx
import { useVisibility } from "@himanshu-sorathiya/react-kit/state";

interface Product {
	id: number;
	name: string;
}

const products: Product[] = [
	{ id: 1, name: "Keyboard" },
	{ id: 2, name: "Mouse" },
	{ id: 3, name: "Monitor" },
];

function ProductFilter() {
	const { isVisible, toggleVisibility, showAll, hideAll, visibleCount } = useVisibility({
		items: products,
		field: "id",
	});

	return (
		<div>
			<button onClick={() => showAll()}>Select All</button>
			<button onClick={() => hideAll()}>Deselect All</button>
			<p>{visibleCount} selected</p>
			{products.map((product) => (
				<label key={product.id}>
					<input
						type="checkbox"
						checked={isVisible(product)}
						onChange={() => toggleVisibility(product)}
					/>
					{product.name}
				</label>
			))}
		</div>
	);
}
```

## Real-World Use Cases

- Managing table column visibility toggles in a data grid
- Filtering a gallery of images by category tags
- Bulk row selection in an admin dashboard (e.g. "select all to delete")
- Toggling optional form sections on and off
- Showing/hiding chart series or legend entries
- Managing "read more / read less" state across a list of cards
- Controlling which dashboard widgets a user has made visible
- Toggling completed items in a checklist or to-do view
- Managing visible filters/facets in a search or product-listing sidebar
- Progressive disclosure of advanced settings or optional fields

## Gotchas & Edge Cases

### `showAll` vs. `hideAll` With No Argument

These two intentionally behave differently when called with nothing:

- **`showAll()`** acts on the hook's own `items` — it's additive, so anything already visible but no longer in `items` is left alone.
- **`hideAll()`** is a blanket clear — it removes **every** visible id, including ones that don't correspond to anything currently in `items`.

This matters most if your `visibleIds` can ever contain an id that's fallen out of `items` (e.g. a filtered or paginated view). Pass an explicit array to either method to scope it to just that subset instead of relying on the no-argument default.

### Stable References

`visibleIds` is memoized — it only changes reference when the visible set actually changes, so it's safe to use directly in a `useEffect` dependency array. `visibleItems`/`hiddenItems` are memoized against `items`, `field`, and the visible set — passing an inline mapped array as `items` (e.g. `items={data.map(x => x)}`) creates a new reference every render and defeats that memoization. Memoize `items` yourself (e.g. with `useMemo`) whenever it isn't already stable.

### Uniqueness

The hook assumes the value resolved by `field` (or the primitive itself) is unique across `items`. If two items resolve to the same id, a single `show`, `hide`, or `toggleVisibility` call will affect all of them simultaneously.

## See Also

- **[useOrder](../../../../useOrder/README.md)** — manages the sequence and ranking of items within a list.
- **[usePin](../../../../usePin/README.md)** — manages a pinned/favorited subset of a list, independent of visibility.
- **[useExpansion](../../../../useExpansion/README.md)** — a richer primitive than `useVisibility`, adding single/multiple-expansion modes and accordion-style behavior on top of the same show/hide idea.
