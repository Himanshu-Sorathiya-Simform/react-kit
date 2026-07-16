# `useVisibility`

A lightweight, fully type-safe React hook for managing show/hide (visibility) state across any collection of items — primitives or complex objects — without hand-rolling `Set` or array logic yourself.

## Motivation (Why this hook?)

Toggling visibility for a list of things sounds trivial until you actually build it: you end up writing the same `Set`-mutation boilerplate — clone the set, add or delete an id, sync it back into state — over and over, once per feature. `useVisibility` collapses all of that into a single hook.

What makes it worth reaching for instead of rolling your own:

- **Works with primitives and objects alike.** Pass an array of strings or numbers and toggle them directly, or pass an array of objects and tell the hook which key identifies each item — including deeply nested keys via dot-notation (e.g. `"user.id"` or `"metadata.id"`).
- **No manual `Set` juggling.** `show`, `hide`, `toggleVisibility`, `showAll`, and `hideAll` all handle the underlying `Set` mutations internally and expose a plain array (`visibleIds`) for easy consumption.
- **Automatic, memoized partitioning.** You never have to `.filter()` your data yourself — `visibleItems` and `hiddenItems` are derived and memoized for you, recomputing only when `items`, `field`, or the visibility state actually changes.
- **Predictable resets and bulk replacement.** `resetVisibility` snaps back to whatever `initialVisibleIds` you started with, and `replaceVisibility` lets you swap the entire visible set in one call — handy for syncing visibility from an external source (like a saved user preference).

In short: less boilerplate, fewer footguns, and a single consistent API whether you're toggling a badge, a table row, or an entire panel.

## Import Syntax

```tsx
// Preferred
import { useVisibility, type UseVisibilityReturn } from "@himanshu-sorathiya/react-kit/ui";
// Or
import { useVisibility, type UseVisibilityReturn } from "@himanshu-sorathiya/react-kit";
```

---

## Basic Usage

A minimal example using a primitive array of tags. Since the items are primitives, `field` is not required — the values themselves act as the identifiers.

```tsx
import { useVisibility } from "@himanshu-sorathiya/react-kit/ui";

const tags = ["react", "typescript", "hooks", "vite"];

function TagList() {
  const { visibleItems, isVisible, toggleVisibility } = useVisibility({
    items: tags,
  });

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

---

## API Reference

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `items` | `T[]` | Yes | The full source array the hook operates on. Can be an array of primitives (`string \| number`) or an array of objects. |
| `field` | `string` | Conditional | The key used to identify each item, resolved internally via `getValue`. **Optional for primitive arrays**, where the primitive value itself is used as the id. **Required for object arrays**, so the hook knows which property to track. Supports dot-notation for nested keys (e.g. `"metadata.id"` reaches into `item.metadata.id`). |
| `initialVisibleIds` | `VisibilityId[]` (`(number \| string)[]`) | No | The set of ids that should be visible when the hook first mounts. Defaults to `[]` (nothing visible). Also used as the target state for `resetVisibility`. |

> `VisibilityId` is defined as `string | number`.

### Return Values

| Property / Method | Type | Description |
|---|---|---|
| `visibleIds` | `VisibilityId[]` | A fresh array of all currently visible ids, derived from the internal `Set` on every render. |
| `visibleItems` | `T[]` | The subset of `items` whose resolved id is currently visible. Memoized on `items`, `field`, and `visibleIds`. |
| `hiddenItems` | `T[]` | The subset of `items` whose resolved id is currently **not** visible. Memoized the same way as `visibleItems`. |
| `visibleCount` | `number` | The number of currently visible ids — the size of the internal `Set`. |
| `isVisible(itemOrId)` | `(itemOrId: VisibilityId \| T) => boolean` | Accepts either a raw id or a full item; resolves its id via `field` and returns whether it's currently visible. |
| `show(itemOrId)` | `(itemOrId: VisibilityId \| T) => void` | Adds the resolved id to the visible set. No-op if it's already visible. |
| `hide(itemOrId)` | `(itemOrId: VisibilityId \| T) => void` | Removes the resolved id from the visible set. No-op if it's already hidden. |
| `toggleVisibility(itemOrId)` | `(itemOrId: VisibilityId \| T) => void` | Flips the resolved id's visibility: adds it if absent, removes it if present. |
| `showAll(itemsArray?)` | `(itemsArray?: VisibilityId[] \| T[]) => void` | Adds every resolved id from `itemsArray` (or from `items` if omitted) to the visible set, preserving whatever was already visible. |
| `hideAll(itemsArray?)` | `(itemsArray?: VisibilityId[] \| T[]) => void` | Removes every resolved id found in `itemsArray` (or in `items` if omitted) from the visible set. |
| `resetVisibility()` | `() => void` | Resets the visible set back to the original `initialVisibleIds` value the hook was initialized with. |
| `replaceVisibility(newVisibleItems)` | `(newVisibleItems: VisibilityId[] \| T[]) => void` | Discards the current visible set entirely and replaces it with the resolved ids from `newVisibleItems`. |

---

## Advanced Usage & Examples

### Object Array with Nested Keys (Dot-Notation)

When your data is an array of objects, `field` is required. It supports dot-notation, so you can point directly at a nested identifier without flattening your data first — perfect for tracking visibility of specific rows in a list or table.

```tsx
import { useVisibility } from "@himanshu-sorathiya/react-kit/ui";

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
import { useVisibility } from "@himanshu-sorathiya/react-kit/ui";

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
  const { isVisible, toggleVisibility, showAll, hideAll, visibleCount } =
    useVisibility({ items: products, field: "id" });

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

---

## Real-World Use Cases

- Managing table column visibility toggles in a data grid
- Expanding/collapsing accordion or FAQ panels
- Filtering a gallery of images by category tags
- Bulk row selection in an admin dashboard (e.g. "select all to delete")
- Toggling optional form sections on and off
- Showing/hiding chart series or legend entries
- Managing "read more / read less" state across a list of cards
- Controlling which dashboard widgets a user has pinned visible
- Toggling completed items in a checklist or to-do view
- Managing visible filters/facets in a search or product-listing sidebar

---

## Gotchas & Edge Cases

- **`visibleIds` is a new array on every render.** It's rebuilt from the internal `Set` (`[...visibleIds]`) each time the hook runs, so it will never be referentially stable. Don't put it directly into a `useEffect` dependency array — you'll trigger an infinite loop. Depend on `visibleCount` instead, or `JSON.stringify(visibleIds)` if you need the actual contents.
- **Keep `items` referentially stable.** Passing an inline mapped array (e.g. `items={data.map(x => x)}`) creates a brand-new array on every render, which defeats the internal `useMemo` calculations behind `visibleItems` and `hiddenItems` and can cause unnecessary recomputation. Memoize the array (e.g. with `useMemo`) or lift it out of the render path.
- **Ids must be unique.** The hook assumes the value resolved by `field` (or the primitive itself) is unique across `items`. If two items resolve to the same id, a single `show`, `hide`, or `toggleVisibility` call will affect all of them simultaneously.

## See Also

- **[FuzzyHighlighter](../FuzzyHighlighter/README.md)** — highlights matching words or substrings within text based on a live search query.
