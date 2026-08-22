# useSingleSelection

A lightweight, fully type-safe React hook for managing single-item selection state — perfect for dropdowns, radio groups, active navigation highlighting, and any UI where exactly one item can be "active" at a time.

## Motivation (Why this hook?)

Managing single-selection state manually with `useState` seems trivial at first, but it quickly turns repetitive and error-prone once you need more than the bare minimum. Every time you build a selectable list, you end up rewriting the same boilerplate:

- A comparison check to determine if a given item is the active one (`selectedId === item.id`)
- A toggle handler that selects an item if it isn't selected, and deselects it if it is
- A way to reset selection back to some default state
- A boolean flag to know whether *anything* is currently selected
- A way to mark certain items as non-selectable, without that logic leaking into every click handler

`useSingleSelection` encapsulates all of this into a single, reusable, strictly-typed hook. Instead of scattering `===` comparisons and conditional setters across your components, you get a clean, self-documenting API — `select`, `deselect`, `toggle`, `isSelected`, `hasSelection`, and `reset` — all backed by stable, memoized callbacks. Less boilerplate, fewer bugs, and a consistent selection pattern across your entire codebase.

## Import

```tsx
// Preferred
import { useSingleSelection, type UseSingleSelectionReturn } from "@himanshu-sorathiya/react-kit/state";
// Or
import { useSingleSelection, type UseSingleSelectionReturn } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

```tsx
import { useSingleSelection } from "@himanshu-sorathiya/react-kit/state";

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

`useSingleSelection` accepts a single, optional options object:

| Option              | Type                   | Required | Default     | Description                                                                                                                     |
| ------------------- | ---------------------- | -------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `defaultSelectedId` | `TId`                  | No       | `undefined` | The id selected when the hook first mounts, and the id `reset()` restores the selection to.                                     |
| `isDisabled`        | `(id: TId) => boolean` | No       | `undefined` | Marks certain ids as non-selectable. Enforced by `select` and `toggle`; `deselect` is never blocked, regardless of this option. |

> `TId` defaults to `SelectionId` (`string | number`). The hook is generic over it, so `useSingleSelection<UserId>()` narrows every id in the returned API to your own (branded or not) id type, if you want that extra precision — otherwise you can ignore it entirely and just use plain strings or numbers.

### Return Values

`useSingleSelection` returns an object (`UseSingleSelectionReturn`) with the following properties and methods:

| Name           | Type                       | Description                                                                                                                             |
| -------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectedId`   | `TId \| undefined`         | The id of the currently selected item. `undefined` if nothing is selected.                                                                 |
| `hasSelection` | `boolean`                  | `true` if any item is currently selected, `false` otherwise. Correctly reports `true` even for a falsy-but-valid id such as `0` or `""`.  |
| `select`       | `(id: TId) => void`        | Sets the given id as the selected item, replacing any current selection. No-ops if `id` is disabled.                                       |
| `deselect`     | `() => void`                | Clears the current selection, setting `selectedId` back to `undefined`. Takes no arguments. Always works, even for a disabled id.          |
| `toggle`       | `(id: TId) => void`        | Selects the given id if it isn't already selected; deselects it if it is. The select-direction is blocked for a disabled id.               |
| `isSelected`   | `(id: TId) => boolean`     | Returns `true` if the given id matches the current `selectedId`, `false` otherwise. Useful for conditional rendering/styling.               |
| `reset`        | `() => void`                | Resets `selectedId` back to `defaultSelectedId`. Takes no arguments. See [Gotchas](#gotchas--edge-cases) for exactly which value it uses.  |

## Advanced Usage & Examples

### Conditional UI

Use `isSelected(id)` to dynamically style the active item — for example, giving it a distinct background color.

```tsx
import { useSingleSelection } from "@himanshu-sorathiya/react-kit/state";

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
import { useSingleSelection } from "@himanshu-sorathiya/react-kit/state";

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

### Disabling Specific Items

Use `isDisabled` to prevent certain items from being selected — for example, an out-of-stock option in a picker.

```tsx
import { useSingleSelection } from "@himanshu-sorathiya/react-kit/state";

const sizes = [
	{ id: "s", label: "Small", inStock: true },
	{ id: "m", label: "Medium", inStock: false },
	{ id: "l", label: "Large", inStock: true },
];

function SizePicker() {
	const { select, isSelected } = useSingleSelection({
		isDisabled: (id) => !sizes.find((size) => size.id === id)?.inStock,
	});

	return (
		<div>
			{sizes.map((size) => (
				<button key={size.id} disabled={!size.inStock} onClick={() => select(size.id)}>
					{isSelected(size.id) ? "✓ " : ""}
					{size.label}
				</button>
			))}
		</div>
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

- **Reset Logic:** `reset()` restores `selectedId` to the **current** `defaultSelectedId` at the moment it's called — not necessarily the value that was present when the component first mounted. If `defaultSelectedId` changes across renders (e.g. it's derived from a prop), `reset()` will restore to whatever that value is *now*. The initial selection on mount, on the other hand, is only ever seeded from the value present on the first render.
- **`isDisabled` doesn't retroactively clear selection:** if an already-selected id later starts returning `true` from `isDisabled` (e.g. an item that was selectable becomes unavailable), the hook won't automatically deselect it — `isDisabled` only guards *new* selections. If you need the selection to clear automatically the moment something becomes disabled, reconcile that yourself (e.g. in a `useEffect`).
- **Type Flexibility:** `SelectionId` is `string | number`, so the hook works equally well with database-generated ids (strings or numeric primary keys) and simple array indices, without requiring any casting or conversion on your part. If you want stronger typing than a plain `string | number` (e.g. a branded `type UserId = string & { __brand: "UserId" }`), pass it as the generic: `useSingleSelection<UserId>()`.

## See Also

- [useMultipleSelection](../useMultipleSelection/README.md) — manages selection logic for multiple concurrent items, for when more than one item can be selected at once.
- [useTreeSelection](../useTreeSelection/README.md) — manages hierarchical selection with parent/child cascading, for checkbox trees, nested category pickers, and file explorers.
