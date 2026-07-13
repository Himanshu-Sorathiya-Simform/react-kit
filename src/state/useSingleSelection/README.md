# useSingleSelection

A lightweight, fully type-safe React hook for managing single-item selection state — perfect for dropdowns, radio groups, active navigation highlighting, and any UI where exactly one item can be "active" at a time.

## Motivation (Why this hook?)

Managing single-selection state manually with `useState` seems trivial at first, but it quickly turns repetitive and error-prone once you need more than the bare minimum. Every time you build a selectable list, you end up rewriting the same boilerplate:

- A comparison check to determine if a given item is the active one (`selectedId === item.id`)
- A toggle handler that selects an item if it isn't selected, and deselects it if it is
- A way to reset selection back to some default state
- A boolean flag to know whether *anything* is currently selected

`useSingleSelection` encapsulates all of this into a single, reusable, strictly-typed hook. Instead of scattering `===` comparisons and conditional setters across your components, you get a clean, self-documenting API — `select`, `deselect`, `toggle`, `isSelected`, `hasSelection`, and `resetSelection` — all backed by stable, memoized callbacks. Less boilerplate, fewer bugs, and a consistent selection pattern across your entire codebase.

## Import

```tsx
import { useSingleSelection, type UseSingleSelectionReturn } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

```tsx
import { useSingleSelection } from "@himanshu-sorathiya/react-kit";

const items = [
	{ id: 1, label: "Item One" },
	{ id: 2, label: "Item Two" },
	{ id: 3, label: "Item Three" },
];

function ItemList() {
	const { selectedId, select, deselect } = useSingleSelection();

	return (
		<div>
			<ul>
				{items.map((item) => (
					<li key={item.id} onClick={() => select(item.id)}>
						{item.label} {selectedId === item.id && "(selected)"}
					</li>
				))}
			</ul>
			<button onClick={deselect}>Deselect</button>
		</div>
	);
}
```

## API Reference

### Parameters

| Parameter          | Type                     | Required | Default     | Description                                                                                     |
| ------------------ | ------------------------ | -------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `initialSelectedId` | `SelectionId` | No       | `undefined` | The `id` that should be selected when the hook is first initialized (on component mount). |

> `SelectionId` is defined as `string | number`.

### Return Values

`useSingleSelection` returns an object (`UseSingleSelectionReturn`) with the following properties and methods:

| Name             | Type                                | Description                                                                                                                                              |
| ---------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectedId`     | `string \| number \| undefined`     | The `id` of the currently selected item. `undefined` if nothing is selected.                                                                              |
| `hasSelection`   | `boolean`                           | `true` if any item is currently selected, `false` otherwise. Derived from `selectedId`.                                                                    |
| `select`         | `(id: string \| number) => void`    | Sets the given `id` as the selected item, regardless of the current state.                                                                                 |
| `deselect`       | `() => void`                        | Clears the current selection, setting `selectedId` back to `undefined`. Takes no arguments.                                                                |
| `toggle`         | `(id: string \| number) => void`    | Selects the given `id` if it isn't already selected; deselects it (sets `selectedId` to `undefined`) if it is already the selected item.                   |
| `isSelected`     | `(id: string \| number) => boolean` | Returns `true` if the given `id` matches the current `selectedId`, `false` otherwise. Useful for conditional rendering/styling.                            |
| `resetSelection` | `() => void`                        | Resets `selectedId` back to the original `initialSelectedId` value provided when the hook was first called. Takes no arguments. See Gotchas below.        |

## Advanced Usage & Examples

### Conditional UI

Use `isSelected(id)` to dynamically style the active item — for example, giving it a distinct background color.

```tsx
import { useSingleSelection } from "@himanshu-sorathiya/react-kit";

const colors = [
	{ id: "red", hex: "#ef4444" },
	{ id: "blue", hex: "#3b82f6" },
	{ id: "green", hex: "#22c55e" },
];

function ColorPicker() {
	const { select, isSelected } = useSingleSelection();

	return (
		<div>
			{colors.map((color) => (
				<button
					key={color.id}
					onClick={() => select(color.id)}
					style={{
						backgroundColor: isSelected(color.id) ? color.hex : "transparent",
						border: isSelected(color.id) ? "2px solid black" : "1px solid gray",
					}}
				>
					{color.id}
				</button>
			))}
		</div>
	);
}
```

### Toggle Interaction

Use `toggle` to let users click an item to select it, and click it again to deselect it.

```tsx
import { useSingleSelection } from "@himanshu-sorathiya/react-kit";

const rows = [
	{ id: 101, name: "Row A" },
	{ id: 102, name: "Row B" },
	{ id: 103, name: "Row C" },
];

function ToggleableRows() {
	const { toggle, isSelected } = useSingleSelection();

	return (
		<ul>
			{rows.map((row) => (
				<li key={row.id} onClick={() => toggle(row.id)}>
					{isSelected(row.id) ? "☑" : "☐"} {row.name}
				</li>
			))}
		</ul>
	);
}
```

## Real-World Use Cases

- Single-select dropdowns and comboboxes
- Radio button groups where only one option can be active
- Highlighting the active item in a navigation menu or sidebar
- Selecting a single card from a grid of selectable cards
- Picking a single color, size, or style preset in a product configurator
- Choosing one row in a table for a "details" or "edit" panel
- Single-image selection in an image gallery or file picker
- Selecting an active tab in a custom (non-native) tab component
- Choosing one payment method or shipping option from a list
- Marking a single item as "featured" or "primary" in an admin dashboard

## Gotchas & Edge Cases

- **Reset Logic:** `resetSelection` reverts `selectedId` to whatever value was passed as `initialSelectedId` **at the time the component mounted**. It does not reactively track later changes to that prop — if the value you originally passed as `initialSelectedId` changes on a subsequent render, `resetSelection` will still reset to the *original* mount-time value, not the newer one.
- **Type Flexibility:** `SelectionId` is typed as `string | number`, so the hook works equally well with database-generated IDs (strings or numeric primary keys) and simple array indices, without requiring any casting or conversion on your part.

## See Also

- [useMultipleSelection](../useMultipleSelection/README.md) — manages selection logic for multiple concurrent items, for when more than one item can be selected at once.
- [useOrder](../useOrder/README.md) — manages the sequence of items in a list, useful for reordering and drag-and-drop scenarios.
- [useSort](../useSort/README.md) — sorts lists based on complex, configurable criteria.
- [useFilter](../useFilter/README.md) — filters lists based on one or more conditions.
