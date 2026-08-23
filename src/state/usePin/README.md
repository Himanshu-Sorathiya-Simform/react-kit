# usePin

A lightweight, fully type-safe React hook for managing "pinned" or "favorited" items in a list — with automatic partitioning, live-adjustable max-limit enforcement, and zero external dependencies.

## Motivation (Why this hook?)

Pinning, favoriting, and "sticky" list behavior are everywhere — chat threads, dashboards, file explorers, e-commerce wishlists — yet almost every team ends up re-implementing the same fragile pattern: a `Set` of IDs in `useState`, a hand-rolled `.filter()` to split the list, and manual `.has()` checks scattered across components.

`usePin` collapses all of that boilerplate into a single, predictable hook:

- **Works with primitives *and* objects out of the box.** Pass an array of strings or numbers, or an array of complex objects — `usePin` handles both consistently under the hood.
- **Dot-notation field resolution.** For object arrays, just tell the hook which key identifies each item — including nested paths like `metadata.id` — and it handles the rest.
- **Compile-time safety for object mode.** Try to pass an object item without configuring `field`? TypeScript won't let you build — this is caught before you ever run the code, not at runtime.
- **Automatic partitioning via `useMemo`.** You never write a `.filter()` again. `pinnedItems` and `unpinnedItems` are derived and memoized for you on every relevant change.
- **Built-in, live-adjustable `maxPins` safety.** Cap how many items can be pinned at once, check `canPin`/`isAtMaxLimit` before you even try, and change the limit at runtime with `changeMaxPins`.
- **A complete, batteries-included API.** Single-item and bulk operations (`pin`, `unpin`, `togglePin`, `pinAll`, `unpinAll`, `replacePins`), plus reset/clear utilities, are all provided.

In short: less state-shuffling code, fewer edge-case bugs, and a consistent mental model for "pinning" across your entire app.

## Import Syntax

```tsx
// Preferred
import { usePin, type UsePinReturn } from "@himanshu-sorathiya/react-kit/state";
// Or
import { usePin, type UsePinReturn } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

The simplest use case: pinning a primitive array (e.g., string tags). Because the items *are* their own IDs, the `field` option is not required.

```tsx
import { usePin } from "@himanshu-sorathiya/react-kit/state";

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

## API Reference

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `items` | `T[]` | Conditional | — | The full source array to be partitioned into pinned/unpinned, and the default target for `pinAll()` when it's called with no argument. **Required in object mode** (alongside `field`); optional for id-only usage. |
| `field` | `string` | Conditional | `undefined` | The key used to derive each item's ID. **Required when `items` is an array of objects** (object mode) — supports dot-notation for nested properties (e.g. `"metadata.id"`). **Must be omitted** when `items` is an array of primitives (`string \| number`); TypeScript will flag it if included there. |
| `initialPinnedIds` | `PinId[]` | No | `[]` | IDs to be pre-pinned when the hook first mounts. Also the value `resetPins()` restores. Truncated (with a dev-mode warning) if it exceeds `maxPins`. |
| `maxPins` | `number` | No | Unlimited | The maximum number of items that may be pinned simultaneously. |

> `PinId` is defined as `string | number`.

### Return Values

| Property / Method | Type | Description |
|---|---|---|
| `pinnedIds` | `readonly PinId[]` | Every currently pinned ID. Memoized — stable across renders when the pinned set hasn't changed. |
| `pinnedItems` | `readonly T[]` | The subset of `items` whose derived ID is currently pinned. Memoized. |
| `unpinnedItems` | `readonly T[]` | The subset of `items` whose derived ID is **not** currently pinned. Memoized. |
| `pinnedCount` | `number` | The current number of pinned IDs. |
| `hasPins` | `boolean` | `true` if at least one item is pinned. |
| `isAtMaxLimit` | `boolean` | `true` if `pinnedCount >= maxPins`. |
| `maxPins` | `number` | The current pin limit. |
| `pin(itemOrId)` | `(itemOrId: PinId \| T) => void` | Pins a single item or raw ID. No-ops if it's already pinned or `maxPins` has been reached. |
| `unpin(itemOrId)` | `(itemOrId: PinId \| T) => void` | Unpins a single item or raw ID. No-ops if it isn't currently pinned. Always allowed, regardless of `maxPins`. |
| `togglePin(itemOrId)` | `(itemOrId: PinId \| T) => void` | Pins the item if unpinned, or unpins it if already pinned. The pin-direction respects `maxPins`; the unpin-direction never is blocked. |
| `isPinned(itemOrId)` | `(itemOrId: PinId \| T) => boolean` | Returns whether the given item or raw ID is currently pinned. |
| `canPin(itemOrId)` | `(itemOrId: PinId \| T) => boolean` | Whether `pin(itemOrId)` would currently have an effect — `true` if it's already pinned (a no-op call still "succeeds") or there's room under `maxPins`. |
| `clearPins()` | `() => void` | Unpins everything. |
| `resetPins()` | `() => void` | Restores the pinned set back to the `initialPinnedIds` value the hook had at mount. |
| `replacePins(newPinnedItems)` | `(newPinnedItems: PinId[] \| T[]) => void` | Wholesale-replaces the pinned set with the derived IDs of `newPinnedItems`, truncated to `maxPins` if it exceeds the current limit. |
| `pinAll(itemsArray?)` | `(itemsArray?: PinId[] \| T[]) => void` | Pins every id/item given, or every item in `items` if called with **no argument**. Stops once `maxPins` is hit — whatever already fit stays pinned. |
| `unpinAll(itemsArray?)` | `(itemsArray?: PinId[] \| T[]) => void` | Unpins every id/item given, or **unpins everything** if called with no argument — see [Gotchas](../../../README.md#pinall-vs-unpinall-with-no-argument). |
| `changeMaxPins(newMaxPins)` | `(newMaxPins: number) => void` | Changes `maxPins` to a new value. Does not retroactively unpin anything already over the new limit. |
| `resetMaxPins()` | `() => void` | Restores `maxPins` to the value it had at mount. Independent of `resetPins()` — resetting one doesn't touch the other. |

## Advanced Usage & Examples

### Object Array with Max Limits

Cap the number of pinned dashboard widgets at 3, and disable further pinning once the limit is hit:

```tsx
import { usePin } from "@himanshu-sorathiya/react-kit/state";

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
	const { pinnedItems, unpinnedItems, pin, unpin, isPinned, canPin } = usePin({
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
						disabled={!canPin(widget)}
						onClick={() => (isPinned(widget) ? unpin(widget) : pin(widget))}
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

Use `pinAll` to pin several items in one go (or everything, with no argument), and `replacePins` to overwrite the pinned set entirely. Both are automatically clamped to `maxPins`:

```tsx
import { usePin } from "@himanshu-sorathiya/react-kit/state";

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
	const { pinnedItems, pinAll, unpinAll, replacePins } = usePin({
		items: contacts,
		field: "id",
		maxPins: 2,
	});

	const pinTopTwo = () => pinAll([contacts[0], contacts[1]]);
	const pinEveryContact = () => pinAll(); // no argument -> pins from `items`, capped at maxPins
	const clearAllPins = () => unpinAll(); // no argument -> unpins everything

	// Even though 4 items are passed, only the first 2 (maxPins) are retained.
	const overwriteWithAllContacts = () => replacePins(contacts);

	return (
		<div>
			<button onClick={pinTopTwo}>Pin Top 2</button>
			<button onClick={pinEveryContact}>Pin All (capped at limit)</button>
			<button onClick={clearAllPins}>Unpin Everything</button>
			<button onClick={overwriteWithAllContacts}>Replace Pins (auto-truncated)</button>
			<p>Pinned: {pinnedItems.map((c) => c.name).join(", ")}</p>
		</div>
	);
}
```

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

## Gotchas & Edge Cases

### Checking Before You Pin

When `pinnedCount` reaches `maxPins`, `pin()` (and the pinning direction of `togglePin()`) don't throw — the call is silently rejected, in both development and production. In development only, a console warning also explains why. Since that warning isn't user-facing feedback, use `canPin()` (or `isAtMaxLimit`) in your UI to disable "Pin" controls or surface your own message before the user even tries.

### `pinAll` vs. `unpinAll` With No Argument

These two intentionally behave differently when called with nothing:

- **`pinAll()`** acts on the hook's own `items` — it's additive, so anything already pinned that isn't in `items` is left alone.
- **`unpinAll()`** is a blanket clear — it removes **every** pinned ID, including ones that don't correspond to anything currently in `items`.

Pass an explicit array to either one to scope it to just that subset instead.

### Stable References

`pinnedIds` is memoized — it only changes reference when the pinned set actually changes, so it's safe to use directly in dependency arrays. `pinnedItems`/`unpinnedItems` are memoized against `items`, `field`, and the pinned set — if you pass an inline mapped or filtered array as `items` (e.g. `items={data.map(x => x)}`), you create a new reference every render and defeat that memoization. Memoize `items` yourself whenever it isn't already stable.

### Uniqueness

`usePin` assumes the value resolved by `field` (or the primitive itself) is **unique** across `items`. If duplicate IDs exist, pinning one instance will cause every item sharing that ID to appear pinned, since they're indistinguishable to the underlying `Set`.

## See Also

- **[useOrder](../../../../useOrder/README.md)** — manages the sequence and ranking of items within a list, independent of pinning.
- **[useExpansion](../../../../useExpansion/README.md)** — manages which item(s) in a list are expanded, accordion-style or free-form.
- **[useVisibility](../../../../useVisibility/README.md)** — manages a simple show/hide state across a list of items.
