# usePin

A lightweight, fully type-safe React hook for managing "pinned" or "favorited" items in a list — with automatic partitioning, optional max-limit enforcement, and zero external dependencies.

---

## Motivation (Why this hook?)

Pinning, favoriting, and "sticky" list behavior are everywhere — chat threads, dashboards, file explorers, e-commerce wishlists — yet almost every team ends up re-implementing the same fragile pattern: a `Set` of IDs in `useState`, a hand-rolled `.filter()` to split the list, and manual `.has()` checks scattered across components.

`usePin` collapses all of that boilerplate into a single, predictable hook:

- **Works with primitives *and* objects out of the box.** Pass an array of strings or numbers, or an array of complex objects — `usePin` normalizes both through the same internal `getValue` utility.
- **Dot-notation field resolution.** For object arrays, just tell the hook which key identifies each item — including nested paths like `metadata.id` — and it handles the rest.
- **Automatic partitioning via `useMemo`.** You never write a `.filter()` again. `pinnedItems` and `unpinnedItems` are derived and memoized for you on every relevant change.
- **Built-in `maxPins` safety.** Cap how many items can be pinned at once, and let the hook silently and safely reject overflow — no manual guard clauses required.
- **A complete, batteries-included API.** Single-item and bulk operations (`pin`, `unpin`, `togglePin`, `pinMultiple`, `unpinMultiple`, `replacePins`), plus reset/clear utilities, are all provided.

In short: less state-shuffling code, fewer edge-case bugs, and a consistent mental model for "pinning" across your entire app.

---

## Import Syntax

```tsx
import { usePin, type UsePinReturn } from "@himanshu-sorathiya/react-kit";
```

---

## Basic Usage

The simplest use case: pinning a primitive array (e.g., string tags). Because the items *are* their own IDs, the `field` option is not required.

```tsx
import { usePin } from "@himanshu-sorathiya/react-kit";

const tags = ["react", "typescript", "hooks", "vite", "testing"];

function TagList() {
	const { pinnedItems, unpinnedItems, togglePin, isPinned } = usePin({
		items: tags,
	});

	return (
		<ul>
			{[...pinnedItems, ...unpinnedItems].map((tag) => (
				<li key={tag} onClick={() => togglePin(tag)}>
					{isPinned(tag) ? "📌 " : ""}
					{tag}
				</li>
			))}
		</ul>
	);
}
```

---

## API Reference

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `items` | `T[]` | Yes | — | The full source array to be partitioned into pinned/unpinned. Should be a stable or memoized reference (see [Gotchas](#gotchas--edge-cases)). |
| `field` | `string` | Conditional | `undefined` | The key used to derive a unique ID from each item via the internal `getValue` utility. **Optional** when `items` is an array of primitives (`string \| number`) — the primitive value itself is used as the ID. **Required** when `items` is an array of objects. Supports dot-notation for nested properties (e.g., `"metadata.id"`, `"user.profile.uuid"`). |
| `initialPinnedIds` | `PinId[]` | No | `[]` | IDs to be pre-pinned when the hook first mounts. Also serves as the target state for `resetPins()`. |
| `maxPins` | `number` | No | `Number.MAX_SAFE_INTEGER` | The maximum number of items that may be pinned simultaneously. Once reached, further `pin` calls are silently ignored (see [Gotchas](#gotchas--edge-cases)). |

> `PinId` is defined as `string | number`.

### Return Values

| Property / Method | Type | Description |
|---|---|---|
| `pinnedIds` | `PinId[]` | A new array (spread from the internal `Set`) of every currently pinned ID. |
| `pinnedItems` | `T[]` | The subset of `items` whose derived ID is currently pinned. Memoized via `useMemo`. |
| `unpinnedItems` | `T[]` | The subset of `items` whose derived ID is **not** currently pinned. Memoized via `useMemo`. |
| `pinnedCount` | `number` | The current size of the pinned-IDs set. |
| `hasPins` | `boolean` | `true` if at least one item is pinned (`pinnedCount > 0`). |
| `isAtMaxLimit` | `boolean` | `true` if `pinnedCount >= maxPins`. Useful for disabling "Pin" controls in the UI. |
| `pin(itemOrId)` | `(itemOrId: PinId \| T) => void` | Pins a single item or raw ID. No-ops if `maxPins` has already been reached. |
| `unpin(itemOrId)` | `(itemOrId: PinId \| T) => void` | Unpins a single item or raw ID. No-ops if it isn't currently pinned. |
| `togglePin(itemOrId)` | `(itemOrId: PinId \| T) => void` | Pins the item if unpinned, or unpins it if already pinned. Respects `maxPins` when adding. |
| `isPinned(itemOrId)` | `(itemOrId: PinId \| T) => boolean` | Returns whether the given item or raw ID is currently pinned. |
| `clearPins()` | `() => void` | Unpins everything, resulting in an empty pinned set. |
| `resetPins()` | `() => void` | Restores the pinned set back to the original `initialPinnedIds` value passed on mount. |
| `replacePins(newPinnedItems)` | `(newPinnedItems: PinId[] \| T[]) => void` | Wholesale-replaces the pinned set with the derived IDs of `newPinnedItems`. Automatically truncated to `maxPins` via `.slice(0, maxPins)`. |
| `pinMultiple(newItems)` | `(newItems: PinId[] \| T[]) => void` | Adds several items to the existing pinned set at once, stopping once `maxPins` is hit. |
| `unpinMultiple(itemsToRemove)` | `(itemsToRemove: PinId[] \| T[]) => void` | Removes several items from the pinned set at once. |

---

## Advanced Usage & Examples

### Object Array with Max Limits

Cap the number of pinned dashboard widgets at 3, and disable further pinning once the limit is hit.

```tsx
import { usePin } from "@himanshu-sorathiya/react-kit";

interface Widget {
	metadata: { id: string };
	title: string;
}

const widgets: Widget[] = [
	{ metadata: { id: "w1" }, title: "Revenue" },
	{ metadata: { id: "w2" }, title: "Active Users" },
	{ metadata: { id: "w3" }, title: "Error Rate" },
	{ metadata: { id: "w4" }, title: "Latency" },
];

function WidgetBoard() {
	const { pinnedItems, unpinnedItems, pin, unpin, isPinned, isAtMaxLimit } =
		usePin({
			items: widgets,
			field: "metadata.id",
			maxPins: 3,
		});

	return (
		<div>
			{[...pinnedItems, ...unpinnedItems].map((widget) => (
				<div key={widget.metadata.id}>
					<span>{widget.title}</span>
					<button
						disabled={!isPinned(widget) && isAtMaxLimit}
						onClick={() =>
							isPinned(widget) ? unpin(widget) : pin(widget)
						}
					>
						{isPinned(widget) ? "Unpin" : "Pin"}
					</button>
				</div>
			))}
		</div>
	);
}
```

### Bulk Actions

Use `pinMultiple` to pin several items in one go, or `replacePins` to overwrite the pinned set entirely. If the replacement array exceeds `maxPins`, it is automatically truncated via `.slice(0, maxPins)` — no manual clamping needed.

```tsx
import { usePin } from "@himanshu-sorathiya/react-kit";

interface Contact {
	id: number;
	name: string;
}

const contacts: Contact[] = [
	{ id: 1, name: "Ada" },
	{ id: 2, name: "Grace" },
	{ id: 3, name: "Alan" },
	{ id: 4, name: "Linus" },
];

function ContactList() {
	const { pinnedItems, pinMultiple, replacePins } = usePin({
		items: contacts,
		field: "id",
		maxPins: 2,
	});

	const pinTopTwo = () => pinMultiple([contacts[0], contacts[1]]);

	// Even though 4 items are passed, only the first 2 (maxPins) are retained.
	const overwriteWithAllContacts = () => replacePins(contacts);

	return (
		<div>
			<button onClick={pinTopTwo}>Pin Top 2</button>
			<button onClick={overwriteWithAllContacts}>
				Replace Pins (auto-truncated)
			</button>
			<p>Pinned: {pinnedItems.map((c) => c.name).join(", ")}</p>
		</div>
	);
}
```

---

## Real-World Use Cases

- Pinned messages at the top of a chat thread
- Favorite or starred contacts in an address book
- Sticky, reorderable widgets on an analytics dashboard
- Top-priority tasks surfaced above a general to-do list
- Saved/favorited search filters or query presets
- "Bookmarked" articles or documentation pages
- Highlighted rows in a data table or admin panel
- Featured or promoted products in an e-commerce grid
- Quick-access shortcuts in a file explorer or command palette
- Watchlisted stocks or crypto assets on a trading dashboard

---

## Gotchas & Edge Cases

### Silent Limit Enforcement

When `pinnedCount` reaches `maxPins`, calling `pin()` (or the pinning branch of `togglePin()`) does **not** throw or warn — it simply returns the previous state unchanged. Always check `isAtMaxLimit` in your UI to disable "Pin" controls or surface feedback (e.g., a toast or tooltip) so users understand why the action had no effect.

### `pinnedIds` Reference Issue

`pinnedIds` is computed as `[...pinnedIds]` on **every render**, meaning it is a brand-new array reference each time, even if its contents haven't changed. **Do not** place `pinnedIds` directly into a `useEffect` (or similar) dependency array — it will cause an infinite re-run loop. Prefer `pinnedCount` for a cheap, stable dependency, or `JSON.stringify(pinnedIds)` if you need to react to the actual contents.

### Stable `items` Reference

`pinnedItems` and `unpinnedItems` are derived via `useMemo`, keyed on the `items` reference. If you pass an inline mapped or filtered array (e.g., `items={data.map(x => x)}`), you create a new array on every render, defeating the memoization and forcing a recompute every time. Memoize `items` yourself (`useMemo`, a stable prop, etc.) whenever possible.

### Uniqueness

`usePin` assumes the value resolved by `field` (or the primitive itself) is **unique** across `items`. If duplicate IDs exist, pinning one instance will cause every item sharing that ID to appear pinned, since they're indistinguishable to the underlying `Set`.

---

## See Also

- **[useOrder](../../state/useOrder/README.md)** — manages the sequence and ranking of items within a list.
- **[useVisibility](../useVisibility/README.md)** — manages the toggle-visibility state of individual list items.
- **[useSingleSelection](../../state/useSingleSelection//README.md)** — handles single and multi-selection logic across a list.
