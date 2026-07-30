# `useSessionStorage`

An SSR-safe, same-tab synchronized React state hook for `sessionStorage` — purpose-built for temporary, tab-scoped data, with the same zero-effort serialization support for `Map`, `Set`, `Date`, and `BigInt` you get from `useLocalStorage`.

`useSessionStorage` behaves like `useState`, except the value survives a page refresh, stays in sync across every component subscribed to the same key in that tab, and is automatically wiped the moment the tab closes.

```tsx
const { value, setValue, removeValue, isHydrated, error } = useSessionStorage("wizard-step", 1);
```

---

## Motivation (Why this hook?)

Not all persisted state should live forever. `useSessionStorage` gives you `useState`-like ergonomics for the data that should only outlive a refresh — not the browser session itself.

### Tab-Isolated Persistence

Perfect for temporary data that needs to survive a page refresh but should cleanly disappear the moment the user closes the tab — draft form inputs, in-progress wizard steps, or anything else that shouldn't linger after the user is done. Unlike `localStorage`, nothing written here outlives the tab it was written in.

### Same-Tab Synchronization

Drop-in state sync across every component reading the same key **within the same tab**. If Component A calls `setValue`, Component B instantly re-renders with the new value — no prop drilling, no context provider, no manual event wiring.

### Advanced Data Types

Native `sessionStorage` only supports strings, which normally makes persisting a `Map`, `Set`, `Date`, or `BigInt` painful. `useSessionStorage` shares the exact same built-in serializers as `useLocalStorage` (`mapSerializer`, `setSerializer`, `dateSerializer`, `bigIntSerializer`), so complex JS values round-trip safely with zero manual effort.

### SSR / Next.js Ready

Server-rendered apps have no access to `sessionStorage`, a classic source of hydration mismatch errors. `isHydrated` and `initializeWithValue` give you precise, built-in control over what renders on the server versus the client, so you can eliminate those mismatches entirely.

---

## Import Syntax

```tsx
// Preferred
import { useSessionStorage, setSerializer, dateSerializer } from "@himanshu-sorathiya/react-kit/storage";

// OR
import { useSessionStorage, setSerializer, dateSerializer } from "@himanshu-sorathiya/react-kit";
```

---

## API Reference

### Arguments

| Argument | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `key` | `string` |  | The `sessionStorage` key to bind to. **Locked on first render** — see [Gotchas](#immutable-keys) below. |
| `initialValue` | `T` |  | The value to use when the key doesn't exist in storage yet, or on the server before hydration. |
| `options` | `UseSessionStorageOptions<T>` |  | Optional configuration object — see below. |

#### `options`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `serializer` | `StorageSerializer<T>` | JSON-based | Custom `serialize` / `deserialize` pair. Use a built-in preset or supply your own. |
| `initializeWithValue` | `boolean` | `true` | When `true`, reads storage synchronously on mount. Set to `false` to defer the read and avoid SSR hydration mismatches. |
| `sameInstanceSync` | `boolean` | `true` | Keeps every hook instance sharing this key in sync **within the same tab**. |


### Returns

| Property | Type | Description |
| :--- | :--- | :--- |
| `value` | `T \| undefined` | The current stored value, or `initialValue` when the key is absent. |
| `setValue` | `(valueOrUpdater: T \| ((prev: T \| undefined) => T)) => void` | Updates the stored value. Accepts a direct value **or an updater function**, just like the `useState` setter. |
| `removeValue` | `() => void` | Removes the key from storage and resets `value` back to `initialValue`. |
| `isHydrated` | `boolean` | `true` once the hook has synchronized with the real storage value. Use this to safely gate SSR-sensitive rendering. |
| `error` | `Error \| null` | The last error encountered during read, write, or sync — or `null` when everything is operating normally. |

---

## Advanced Usage & Examples

### Example 1: Basic Usage (Multi-Step Form Wizard)

Track the current step of a wizard so a refresh doesn't send the user back to square one — while keeping it scoped to just this tab.

```tsx
import { useSessionStorage } from "@himanshu-sorathiya/react-kit/storage";

function SignupWizard() {
  const { value: step, setValue: setStep } = useSessionStorage("wizard-step", 1);

  return (
    <div>
      <p>Step {step} of 3</p>
      <button onClick={() => setStep((prev) => Math.max(1, (prev ?? 1) - 1))}>Back</button>
      <button onClick={() => setStep((prev) => Math.min(3, (prev ?? 1) + 1))}>Next</button>
    </div>
  );
}
```

### Example 2: Complex Data with Serializers

Track a temporary set of selected table row IDs, toggling membership via an updater function.

```tsx
import { useSessionStorage, setSerializer } from "@himanshu-sorathiya/react-kit/storage";

function SelectableTable() {
  const { value: selectedIds, setValue: setSelectedIds } = useSessionStorage(
    "selected-row-ids",
    new Set<number>(),
    { serializer: setSerializer<number>() },
  );

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div>
      <button onClick={() => toggleRow(42)}>Toggle row 42</button>
      <p>Selected rows: {selectedIds?.size ?? 0}</p>
    </div>
  );
}
```

### Example 3: Safe SSR / Next.js Rendering

Defer the storage read with `initializeWithValue: false` and gate rendering on `isHydrated` so server and client markup match on first paint.

```tsx
import { useSessionStorage } from "@himanshu-sorathiya/react-kit/storage";

function DraftBanner() {
  const { value: draftSaved, isHydrated } = useSessionStorage<boolean>("draft-saved", false, {
    initializeWithValue: false,
  });

  if (!isHydrated) {
    return <div>Checking draft status…</div>;
  }

  return <p>{draftSaved ? "Draft saved for this session." : "No draft saved yet."}</p>;
}
```

---

## Real-World Use Cases

- Preserving multi-step form or checkout wizard progress across a refresh
- Temporary search and filter UI states that shouldn't outlive the visit
- Tracking "seen" status for one-time session alerts or dismissible banners
- Tab-specific shopping cart or comparison-list configurations
- Isolating sensitive data on shared or public computers that must not persist
- Caching scroll position or expanded/collapsed UI state within a single visit
- Storing an in-progress upload or editor draft before final submission
- Remembering which onboarding tooltip step a user is on for the current visit

---

## Gotchas & Edge Cases

### Tab Isolation (Browser Behavior)
`sessionStorage` is strictly bound to the active tab by the browser itself — this is not a limitation of the hook, it's the platform contract. Duplicating a tab or opening a link in a new tab creates a completely blank, isolated session; nothing written in the original tab will be visible there. If you need state that persists and syncs across multiple open tabs, reach for [`useLocalStorage`](../useLocalStorage/README.md) instead.

### Immutable Keys

The `key` argument is locked to whatever value it holds on the **first render** and cannot be changed dynamically afterward. If your use case genuinely requires switching keys, don't pass a new `key` argument to the hook — instead, unmount and remount the component by changing React's own `key` prop on it, forcing a fresh hook instance to mount with the new storage key.

### Storage Quotas & Rollbacks

If a write exceeds the browser's storage quota (`QuotaExceededError`), `setValue` will **not** apply the update. The hook automatically rolls the state back to its previous value and populates `error` with the failure details, so your component never ends up in an inconsistent state or crashes the app.

---

## See Also

- [`useLocalStorage`](../useLocalStorage/README.md) — for permanent data persistence that survives closed tabs and syncs globally across all open tabs.
- [`useEventListener`](../../events/useEventListener/README.md) — the underlying event-binding utility that powers same-tab synchronisation.
