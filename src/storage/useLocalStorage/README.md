# `useLocalStorage`

An SSR-safe, fully synchronized React state hook for `localStorage` — with zero-effort serialization for complex data types like `Map`, `Set`, `Date`, and `BigInt`.

`useLocalStorage` behaves like `useState`, except the value survives page reloads, stays in sync across every component subscribed to the same key, and never crashes your app when storage misbehaves.

```tsx
const { value, setValue, removeValue, isHydrated, error } = useLocalStorage("theme", "light");
```

---

## Motivation (Why this hook?)

Reaching for `localStorage` directly in React usually means re-solving the same four problems on every project. `useLocalStorage` solves them once, so you don't have to.

### Flawless Synchronization

State written to a key by one component is a drop-in state sync for every other component reading that same key — **in the same tab, and natively across other open browser tabs.** Change the theme in one tab, watch it update everywhere, instantly, with no extra wiring.

### Advanced Data Types, Handled Natively

`localStorage` can only store strings, which means `Map`, `Set`, `Date`, and `BigInt` normally break the moment you try to persist them. `useLocalStorage` ships with built-in serializers that safely stringify and parse these types for you — no manual `JSON.stringify` gymnastics required.

### SSR / Next.js Ready

Server-rendered apps don't have access to `localStorage`, which is a classic source of hydration mismatch errors. `isHydrated` and `initializeWithValue` give you precise, built-in control over what renders on the server versus the client, so you can eliminate mismatches entirely.

### Graceful Failure, Always

Quota exceeded? Malformed JSON already sitting in storage? A custom serializer that throws? `useLocalStorage` never lets these become explosive runtime errors. Every failure is caught, logged to the console with a clear warning, and surfaced through the `error` return value — your UI stays in a valid, predictable state no matter what.

---

## Import Syntax

```tsx
// Preferred
import { useLocalStorage, mapSerializer, dateSerializer } from "@himanshu-sorathiya/react-kit/storage";

// OR
import { useLocalStorage, mapSerializer, dateSerializer } from "@himanshu-sorathiya/react-kit";
```

---

## API Reference

### Arguments

| Argument | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `key` | `string` | ✅ | The `localStorage` key to bind to. **Locked on first render** — see [Gotchas](#immutable-keys) below. |
| `initialValue` | `T` |  | The value to use when the key doesn't exist in storage yet, or on the server before hydration. |
| `options` | `UseLocalStorageOptions<T>` |  | Optional configuration object — see below. |

#### `options`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `serializer` | `StorageSerializer<T>` | JSON-based | Custom `serialize` / `deserialize` pair. Use a built-in preset or supply your own. |
| `initializeWithValue` | `boolean` | `true` | When `true`, reads storage synchronously on mount. Set to `false` to defer the read and avoid SSR hydration mismatches. |
| `sameInstanceSync` | `boolean` | `true` | Keeps every hook instance sharing this key in sync **within the same tab**. |
| `crossInstanceSync` | `boolean` | `true` | Keeps the hook in sync when the same key changes **in another browser tab or window**. |

### Returns

| Property | Type | Description |
| :--- | :--- | :--- |
| `value` | `T \| undefined` | The current stored value, or `initialValue` when the key is absent. |
| `setValue` | `(valueOrUpdater: T \| ((prev: T \| undefined) => T)) => void` | Updates the stored value. Accepts a direct value **or an updater function**, just like the `useState` setter. |
| `removeValue` | `() => void` | Removes the key from storage and resets `value` back to `initialValue`. |
| `isHydrated` | `boolean` | `true` once the hook has synchronized with the real storage value. Use this to safely gate SSR-sensitive rendering. |
| `error` | `Error \| null` | The last error encountered during read, write, or sync — or `null` when everything is operating normally. |

### Built-in Serializers

| Serializer | Handles | Notes |
| :--- | :--- | :--- |
| `defaultSerializer` | Primitives, plain objects, arrays | Used automatically when no `serializer` option is passed. |
| `mapSerializer<K, V>()` | `Map<K, V>` | `K` and `V` must be JSON-serializable. |
| `setSerializer<V>()` | `Set<V>` | `V` must be JSON-serializable. |
| `dateSerializer` | `Date` | Serializes via ISO 8601 string. |
| `bigIntSerializer` | `bigint` | Serializes as a numeric string. |

---

## Advanced Usage & Examples

### Example 1: Basic Usage & Sync

A simple, drop-in persisted value — try opening this component in two tabs and toggling the theme in one.

```tsx
import { useLocalStorage } from "@himanshu-sorathiya/react-kit/storage";

function ThemeToggle() {
  const { value: theme, setValue: setTheme, removeValue: resetTheme } = useLocalStorage(
    "theme",
    "light",
  );

  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
        Toggle theme
      </button>
      <button onClick={resetTheme}>Reset to default</button>
    </div>
  );
}
```

### Example 2: Complex Data with Serializers

Persist a `Map` and update it in place using an updater function.

```tsx
import { useLocalStorage, mapSerializer } from "@himanshu-sorathiya/react-kit/storage";

function VisitedPagesTracker() {
  const { value: visitedPages, setValue: setVisitedPages } = useLocalStorage(
    "visited-pages",
    new Map<string, number>(),
    { serializer: mapSerializer<string, number>() },
  );

  const recordVisit = (path: string) => {
    setVisitedPages((prev) => {
      const next = new Map(prev);
      next.set(path, (next.get(path) ?? 0) + 1);
      return next;
    });
  };

  return (
    <div>
      <button onClick={() => recordVisit("/dashboard")}>Visit dashboard</button>
      <p>Total unique pages visited: {visitedPages?.size ?? 0}</p>
    </div>
  );
}
```

### Example 3: Safe SSR / Next.js Rendering

Defer the storage read with `initializeWithValue: false` and gate rendering on `isHydrated` to guarantee the server and client markup match on first paint.

```tsx
import { useLocalStorage } from "@himanshu-sorathiya/react-kit/storage";

function UserGreeting() {
  const { value: username, isHydrated } = useLocalStorage<string>("username", undefined, {
    initializeWithValue: false,
  });

  if (!isHydrated) {
    return <div>Loading greeting…</div>;
  }

  return <p>Welcome back, {username ?? "guest"}!</p>;
}
```

---

## Real-World Use Cases

- Persisting user theme, layout, or accessibility preferences across sessions
- Preserving shopping cart contents between visits and browser tabs
- Auto-saving multi-step form drafts so users never lose progress
- Offline caching of expensive or rarely-changing API responses
- Syncing authentication tokens or session flags across multiple open tabs
- Remembering dashboard filter, sort, and view-mode selections
- Storing recently viewed items or search history
- Tracking onboarding/tutorial completion state per user

---

## Gotchas & Edge Cases

### Immutable Keys

The `key` argument is locked to whatever value it holds on the **first render** and cannot be changed dynamically afterward. If your use case genuinely requires switching keys, don't pass a new `key` argument to the hook — instead, unmount and remount the component by changing React's own `key` prop on it, forcing a fresh hook instance to mount with the new storage key.

### Storage Quotas & Rollbacks

If a write exceeds the browser's storage quota (`QuotaExceededError`), `setValue` will **not** apply the update. The hook automatically rolls the state back to its previous value and populates `error` with the failure details, so your component never ends up in an inconsistent state.

### Custom Serializers

Need to persist a class instance or some other non-JSON-friendly structure? You're not limited to the built-in presets — pass any object implementing `{ serialize: (value) => string; deserialize: (raw) => value }` as the `serializer` option, and the hook will use it for every read and write.

---

## See Also

- [`useSessionStorage`](../useSessionStorage/README.md) — the same ergonomic API for temporary data that clears automatically when the tab closes.
- [`useEventListener`](../../events/useEventListener/README.md) — the underlying event-binding utility that powers cross-tab and same-tab synchronisation.
