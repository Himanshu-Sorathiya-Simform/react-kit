# useOrder

A strictly client-side, fully type-safe React hook for managing the order of items in a list — move, swap, and reorder with zero manual index math.

## Motivation (Why this hook?)

Reordering a list sounds simple until you actually implement it by hand. You end up writing the same brittle logic over and over: cloning arrays so you don't mutate state directly, checking that an index isn't negative or past the end of the array, destructuring-swapping elements without accidentally losing a reference, and re-deriving "is this the first/last item?" in your JSX every time you want to disable a button.

`useOrder` collapses all of that into a single hook with a comprehensive suite of movement utilities:

- **Relative moves** — `movePrevious` / `moveNext` shift an item by one position.
- **Absolute moves** — `moveToStart` / `moveToEnd` pin an item to either end.
- **Arbitrary moves** — `move` relocates an item to any index, sliding everything else over.
- **Exact swaps** — `swap` trades two items' positions without touching anything else.
- **Boundary checks** — `canMovePrevious` / `canMoveNext` tell your UI when to disable controls.
- **Full resets** — `resetOrder` / `replaceOrder` give you control over the underlying data.
- **Move by item, not just index.** Once you tell the hook which field identifies your items, every method above accepts the item itself as well as a raw index — no manual `findIndex` calls in your components.
- **Compile-time safety for object mode.** Try to pass an item without configuring `field`? TypeScript won't let you build — this is caught before you ever run the code, not at runtime.
- **Lock specific items in place.** `isDisabled` marks items that can never move or be displaced.

Every mutating method is **safe by design**: out-of-range calls are silently ignored rather than corrupting state, so you can wire these methods directly to UI events without writing your own bounds checks. (Malformed input — like a non-integer index — is a different story in development; see [Gotchas](../../../README.md#gotchas--edge-cases).)

## Import Syntax

```tsx
// Preferred
import { useOrder, type UseOrderReturn } from "@himanshu-sorathiya/react-kit/state";
// Or
import { useOrder, type UseOrderReturn } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

A minimal list with "Move Up" and "Move Down" controls, using `canMovePrevious` / `canMoveNext` to disable buttons at the boundaries:

```tsx
import { useOrder } from "@himanshu-sorathiya/react-kit/state";

function TodoList() {
	const { orderedItems, movePrevious, moveNext, canMovePrevious, canMoveNext } =
		useOrder(["Write proposal", "Review PR", "Ship release"]);

	return (
		<ul>
			{orderedItems.map((item, index) => (
				<li key={item}>
					{item}
					<button disabled={!canMovePrevious(index)} onClick={() => movePrevious(index)}>
						Move Up
					</button>
					<button disabled={!canMoveNext(index)} onClick={() => moveNext(index)}>
						Move Down
					</button>
				</li>
			))}
		</ul>
	);
}
```

## API Reference

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `initialItems` | `T[]` | No (defaults to `[]`) | The initial array of items to order. Only read once, on mount, to seed the hook's state. |
| `options.isDisabled` | `(item: T, index: number) => boolean` | No | Marks specific items as immovable. See [Locking Items in Place](../../../README.md#locking-items-in-place-isdisabled). |
| `options.field` | `string` | Conditional | A property name used to resolve an item's identity, so it can be passed directly as a move target instead of its index. Once set, every method below also accepts a full item wherever it accepts an index — see [Move by Item](../../../README.md#move-by-item-instead-of-index). |

### Return Values

| Property | Type | Description |
|---|---|---|
| `orderedItems` | `readonly T[]` | The current, live-ordered array of items. This is what you render. |
| `movePrevious(target)` | `(target: number \| T) => void` | Moves the item at `target` one position earlier. No-ops at the start of the list, or if `target`'s item or the item before it is disabled. |
| `moveNext(target)` | `(target: number \| T) => void` | Moves the item at `target` one position later. No-ops at the end of the list, or if `target`'s item or the item after it is disabled. |
| `canMovePrevious(target)` | `(target: number \| T) => boolean` | Whether `movePrevious(target)` would currently have an effect. |
| `canMoveNext(target)` | `(target: number \| T) => boolean` | Whether `moveNext(target)` would currently have an effect. |
| `moveToStart(target)` | `(target: number \| T) => void` | Moves the item at `target` to the very start of the list. No-ops if it's already first, or if it's disabled. |
| `moveToEnd(target)` | `(target: number \| T) => void` | Moves the item at `target` to the very end of the list. No-ops if it's already last, or if it's disabled. |
| `move(from, to)` | `(from: number \| T, to: number \| T) => void` | Relocates the item at `from` to `to`, sliding the items in between over by one. No-ops if `from`/`to` resolve to the same item, or if the item at `from` is disabled. |
| `swap(a, b)` | `(a: number \| T, b: number \| T) => void` | Exchanges the items at `a` and `b` directly, leaving every other item untouched. No-ops if `a`/`b` resolve to the same item, or if either item is disabled. |
| `resetOrder()` | `() => void` | Restores `orderedItems` back to the `initialItems` value the hook had at mount. |
| `replaceOrder(newOrderedItems)` | `(newOrderedItems: T[]) => void` | Replaces the entire ordered array with a brand-new array, discarding the previous state entirely. |

> Without `field` configured, `target`/`from`/`to`/`a`/`b` only ever accept a raw `number` index — TypeScript won't let you pass an item at all until `field` is set.

### Crucial API Distinction: `move` vs. `swap`

These two methods look similar but behave very differently, and picking the wrong one will produce an order you didn't intend:

- **`move(from, to)`** — Think of this as "pick up and re-insert." The item at `from` is removed from the array and inserted at `to`. Every item that sat between the two positions **shifts over by one slot** to fill the gap. This is what you want for drag-and-drop, where dropping an item into a new slot should naturally push the surrounding items aside.

- **`swap(a, b)`** — Think of this as "trade places." Only the two items at `a` and `b` change position — they trade places directly. **No other item in the array is affected.** This is what you want when you need to exchange exactly two items (for example, swapping two players' positions on a leaderboard) without disturbing anything else in between.

```
Before:     [A, B, C, D, E]

move(0, 3): [B, C, D, A, E]   // A is pulled out, B–D shift left, A re-inserted at index 3
swap(0, 3): [D, B, C, A, E]   // only A and D trade places; B and C are untouched
```

## Advanced Usage & Examples

### Direct Positioning — "Pin to Top"

Use `moveToStart` (or `moveToEnd`) to let users instantly promote or demote an item without repeated clicks:

```tsx
import { useOrder } from "@himanshu-sorathiya/react-kit/state";

function PriorityQueue() {
	const { orderedItems, moveToStart, moveToEnd } = useOrder([
		"Low priority ticket",
		"Investigate flaky test",
		"Hotfix payment bug",
	]);

	return (
		<ul>
			{orderedItems.map((item, index) => (
				<li key={item}>
					{item}
					<button onClick={() => moveToStart(index)}>Pin to Top</button>
					<button onClick={() => moveToEnd(index)}>Send to Bottom</button>
				</li>
			))}
		</ul>
	);
}
```

### Move by Item Instead of Index

Configure `field` and pass the item itself directly — no need to track or look up its current index yourself:

```tsx
import { useOrder } from "@himanshu-sorathiya/react-kit/state";

interface Task {
	id: string;
	title: string;
}

const tasks: Task[] = [
	{ id: "t1", title: "Write proposal" },
	{ id: "t2", title: "Review PR" },
	{ id: "t3", title: "Ship release" },
];

function TaskList() {
	const { orderedItems, movePrevious, moveNext, canMovePrevious, canMoveNext } =
		useOrder(tasks, { field: "id" });

	return (
		<ul>
			{orderedItems.map((task) => (
				<li key={task.id}>
					{task.title}
					<button disabled={!canMovePrevious(task)} onClick={() => movePrevious(task)}>
						Move Up
					</button>
					<button disabled={!canMoveNext(task)} onClick={() => moveNext(task)}>
						Move Down
					</button>
				</li>
			))}
		</ul>
	);
}
```

### Locking Items in Place (`isDisabled`)

Pass `isDisabled` to prevent specific items from ever moving:

```tsx
import { useOrder } from "@himanshu-sorathiya/react-kit/state";

interface Step {
	id: string;
	label: string;
	locked?: boolean;
}

const steps: Step[] = [
	{ id: "s1", label: "Account details", locked: true },
	{ id: "s2", label: "Shipping address" },
	{ id: "s3", label: "Payment method" },
	{ id: "s4", label: "Review order", locked: true },
];

function StepOrderEditor() {
	const { orderedItems, movePrevious, moveNext, canMovePrevious, canMoveNext } =
		useOrder(steps, { field: "id", isDisabled: (step) => !!step.locked });

	return (
		<ol>
			{orderedItems.map((step) => (
				<li key={step.id}>
					{step.label}
					<button disabled={!canMovePrevious(step)} onClick={() => movePrevious(step)}>↑</button>
					<button disabled={!canMoveNext(step)} onClick={() => moveNext(step)}>↓</button>
				</li>
			))}
		</ol>
	);
}
```

With `movePrevious`/`moveNext`, a locked item can never move, and it can never be displaced by a neighbor moving into it either — see the note on `moveToStart`/`moveToEnd`/`move` below for why that guarantee is narrower for those three.

## Real-World Use Cases

- Drag-and-drop reordering interfaces
- Custom form builders where fields can be rearranged
- Playlist and queue management (music, video, podcasts)
- Task and ticket prioritization boards
- Image gallery and media carousel sorting
- Multi-step wizard or onboarding flow reordering
- Kanban-style column and card ordering
- Navigation menu / sidebar link customization
- Leaderboard or ranking adjustment tools
- Dashboard widget layout arrangement

## Gotchas & Edge Cases

### Initial State Locking (Async Data)

`initialItems` is only read **once**, on the very first render, to seed the hook's internal state — this is standard React `useState` initializer behavior. If you fetch data asynchronously and pass a new array into `useOrder(newData)` on a re-render, the hook will **not** pick up the new array; it's already initialized and ignores subsequent arguments.

To hydrate the hook with freshly-fetched data, call `replaceOrder(newData)` explicitly once your data arrives:

```tsx
const { orderedItems, replaceOrder } = useOrder<Item>([]);

useEffect(() => {
	fetchItems().then((data) => replaceOrder(data));
}, [replaceOrder]);
```

### Development-Mode Safety Checks

In development, calling any mutating method with malformed input — a non-integer index (`1.5`, `NaN`, `Infinity`), or an item when no `field` option is configured — throws a descriptive error immediately, so a caller bug surfaces the moment it happens rather than silently misbehaving.

A well-formed index or item that's simply out of range right now — already at the start/end of the list, or an item that isn't currently in `orderedItems` — does **not** throw. It's treated as routine, expected usage (e.g. a disabled button being clicked anyway) and the call is silently ignored.

In production builds, malformed input is also silently ignored, same as the out-of-range case — so it's safe to wire every method directly to UI events without writing your own guards, in either environment.

### Negative Indices Count From the End

Every index accepted anywhere in this hook also accepts a negative one, resolved the same way `Array.prototype.at` does: `-1` means the last item, `-2` the second-to-last, and so on. `moveNext(-1)` is a no-op (there's nothing after the last item), while `moveToStart(-1)` moves the very last item all the way to the front.

### `moveToStart` / `moveToEnd` / `move` Only Check the Item Being Moved

`isDisabled` fully protects an item from `movePrevious`/`moveNext`/`swap` — both items involved in a pairwise operation are checked. It's narrower for `moveToStart`/`moveToEnd`/`move`: only the item actually being repositioned is checked. Items it slides past are shifted by one slot, not swapped with it, so their own `isDisabled` state isn't consulted. If you need an item fully immune to *every* operation, don't expose those three controls next to it in your UI.

## See Also

- **[usePin](../../../../usePin/README.md)** — manages a pinned/favorited subset of a list, independent of order.
- **[useExpansion](../../../../useExpansion/README.md)** — manages which item(s) in a list are expanded, accordion-style or free-form.
- **[useVisibility](../../../../useVisibility/README.md)** — manages a simple show/hide state across a list of items.
