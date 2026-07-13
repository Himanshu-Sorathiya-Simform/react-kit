# useOrder

A strictly client-side, fully type-safe React hook for managing the order of items in a list — move, swap, pin, and reorder with zero manual index math.

## Motivation (Why this hook?)

Reordering a list sounds simple until you actually implement it by hand. You end up writing the same brittle logic over and over: cloning arrays so you don't mutate state directly, checking that an index isn't negative or past the end of the array, destructuring-swapping elements without accidentally losing a reference, and re-deriving "is this the first/last item?" in your JSX every time you want to disable a button.

`useOrder` collapses all of that into a single hook with a comprehensive suite of movement utilities:

- **Relative moves** — `moveUp` / `moveDown` shift an item by one position.
- **Absolute moves** — `moveToTop` / `moveToBottom` pin an item to either end.
- **Arbitrary moves** — `move` relocates an item to any index, sliding everything else over.
- **Exact swaps** — `swap` trades two items' positions without touching anything else.
- **Boundary checks** — `canMoveUp` / `canMoveDown` tell your UI when to disable controls.
- **Full resets** — `resetOrder` / `replaceOrder` give you control over the underlying data.

Every mutating method is **index-safe by design**: invalid types, negative numbers, and out-of-bounds indices are silently ignored rather than throwing or corrupting state. You get predictable, crash-proof reordering without writing a single bounds check yourself.

## Import Syntax

```tsx
import { useOrder, type UseOrderReturn } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

A minimal list with "Move Up" and "Move Down" controls, using `canMoveUp` / `canMoveDown` to disable buttons at the boundaries:

```tsx
import { useOrder } from "@himanshu-sorathiya/react-kit";

function TodoList() {
	const { orderedItems, moveUp, moveDown, canMoveUp, canMoveDown } = useOrder([
		"Write proposal",
		"Review PR",
		"Ship release",
	]);

	return (
		<ul>
			{orderedItems.map((item, index) => (
				<li key={item}>
					{item}
					<button disabled={!canMoveUp(index)} onClick={() => moveUp(index)}>
						Move Up
					</button>
					<button disabled={!canMoveDown(index)} onClick={() => moveDown(index)}>
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

| Parameter      | Type  | Required | Description                                                                                  |
| -------------- | ----- | -------- | ---------------------------------------------------------------------------------------------- |
| `initialItems` | `T[]` | Yes      | The initial array of items to order. Only read once, on mount, to seed the hook's state. |

### Return Values

| Property         | Type                                        | Description                                                                                       |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `orderedItems`    | `T[]`                                        | The current, live-ordered array of items. This is what you render.                                |
| `moveUp(index)`          | `(index: number) => void`                    | Swaps the item at `index` with the item directly above it (`index - 1`).                          |
| `moveDown(index)`        | `(index: number) => void`                    | Swaps the item at `index` with the item directly below it (`index + 1`).                          |
| `canMoveUp(index)`       | `(index: number) => boolean`                 | Returns `true` if `index` is greater than `0` (i.e. not already first).                            |
| `canMoveDown(index)`     | `(index: number) => boolean`                 | Returns `true` if `index` is less than the last index of `orderedItems` (i.e. not already last).   |
| `moveToTop(index)`       | `(index: number) => void`                    | Removes the item at `index` and unshifts it to the very front of the array.                       |
| `moveToBottom(index)`    | `(index: number) => void`                    | Removes the item at `index` and pushes it to the very end of the array.                           |
| `move(fromIndex, toIndex)`            | `(fromIndex: number, toIndex: number) => void` | Relocates the item at `fromIndex` to `toIndex`, sliding the items in between over by one.          |
| `swap(indexA, indexB)`            | `(indexA: number, indexB: number) => void`   | Exchanges the items at `indexA` and `indexB` directly, leaving every other item untouched.        |
| `replaceOrder(newOrderedItems)`    | `(newOrderedItems: T[]) => void`             | Replaces the entire ordered array with a brand-new array, discarding the previous state entirely. |
| `resetOrder()`      | `() => void`                                 | Restores `orderedItems` back to the original `initialItems` array passed in on mount.             |

### Crucial API Distinction: `move` vs. `swap`

These two methods look similar but behave very differently, and picking the wrong one will produce an order you didn't intend:

- **`move(fromIndex, toIndex)`** — Think of this as "pick up and re-insert." The item at `fromIndex` is removed from the array and inserted at `toIndex`. Every item that sat between the two positions **shifts over by one slot** to fill the gap. This is what you want for drag-and-drop, where dropping an item into a new slot should naturally push the surrounding items aside.

- **`swap(indexA, indexB)`** — Think of this as "trade places." Only the two items at `indexA` and `indexB` change position — they trade places directly. **No other item in the array is affected.** This is what you want when you need to exchange exactly two items (for example, swapping two players' positions on a leaderboard) without disturbing anything else in between.

```
Before:      [A, B, C, D, E]

move(0, 3):  [B, C, D, A, E]   // A is pulled out, B–D shift left, A re-inserted at index 3
swap(0, 3):  [D, B, C, A, E]   // only A and D trade places; B and C are untouched
```

## Advanced Usage & Examples

### Direct Positioning — "Pin to Top"

Use `moveToTop` (or `moveToBottom`) to let users instantly promote or demote an item without repeated clicks:

```tsx
import { useOrder } from "@himanshu-sorathiya/react-kit";

function PriorityQueue() {
	const { orderedItems, moveToTop, moveToBottom } = useOrder([
		"Low priority ticket",
		"Investigate flaky test",
		"Hotfix payment bug",
	]);

	return (
		<ul>
			{orderedItems.map((item, index) => (
				<li key={item}>
					{item}
					<button onClick={() => moveToTop(index)}>Pin to Top</button>
					<button onClick={() => moveToBottom(index)}>Send to Bottom</button>
				</li>
			))}
		</ul>
	);
}
```

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

### Out-of-Bounds Safety

Every mutating method (`moveUp`, `moveDown`, `moveToTop`, `moveToBottom`, `move`, `swap`) is guarded against invalid input. Passing a negative index, an index beyond the array's bounds, or a non-number value will cause the call to **silently return the previous state** — no exceptions thrown, no application crashes, no corrupted arrays. This means you can wire these methods directly to UI events without defensive checks scattered throughout your components.

## See Also

- [useSort](../useSort/README.md) — automatically sorts arrays based on complex, customizable criteria.
- [useFilter](../useFilter/README.md) — filters lists down to the items that match one or more conditions.
- [usePagination](../usePagination/README.md) — chunks large arrays into manageable, navigable pages.
