# `useLocalStorage`

An SSR-safe, fully synchronized React state hook for `localStorage` — with zero-effort serialization for complex data types like `Map`, `Set`, `Date`, and `BigInt`, and built-in error reporting for production and development alike.

`useLocalStorage` behaves like `useState`, except the value survives page reloads, stays in sync across every component subscribed to the same key — in this tab and every other open tab — and never crashes your app when storage misbehaves.

```tsx
const { value, setValue, removeValue, isHydrated, error } = useLocalStorage("theme", "light");
```

---

## Motivation (Why this hook?)

Reaching for `localStorage` directly in React usually means re-solving the same handful of problems on every project. `useLocalStorage` solves them once, so you don't have to.

### Same-Tab Synchronization

State written to a key by one component is a drop-in state sync for every other component reading that same key **within the same tab**. Change the theme in one place, watch every other component using `useLocalStorage("theme", ...)` update instantly — no prop drilling, no context provider, no manual event wiring.

### Cross-Tab Synchronization

Because `localStorage` is shared across the whole origin, `useLocalStorage` also stays in sync **across other open browser tabs and windows**, via the browser's native `storage` event — including reacting correctly if another tab calls `localStorage.clear()`. Opt out per-instance with `crossInstanceSync: false` if you only want same-tab behavior. See [Same-Origin Only](#same-origin-only-cross-tab-sync) in Gotchas for the one platform-level limit on this.

### Advanced Data Types, Handled Natively

`localStorage` can only store strings, which means `Map`, `Set`, `Date`, and `BigInt` normally break the moment you try to persist them. `useLocalStorage` ships with built-in serializers that safely stringify and parse these types for you — no manual `JSON.stringify` gymnastics required. See [Built-in Serializers](#built-in-serializers) below.

### SSR / Next.js Ready

Server-rendered apps have no access to `localStorage`, a classic source of hydration mismatch errors. `useLocalStorage` is hydration-safe **by default**: on the server, and during the client's very first render, `value` is always `initialValue` — guaranteed to match what the server sent, so React never reports a mismatch. Immediately after hydration, if the real stored value turns out to differ, the hook reconciles to it automatically. `isHydrated` and `initializeWithValue` give you precise control if you'd rather avoid even that brief transition — see [Example 3](#example-3-safe-ssr--nextjs-rendering).

### Robust Error Handling

Quota exceeded? Malformed JSON already sitting in storage? A custom serializer that throws? `useLocalStorage` never lets these become explosive runtime errors. Every failure is caught and reported through the `error` return value, an `onError` callback that fires in every environment (including production), and a console warning in development — see [Error Handling](#error-handling) below.

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
| `key` | `string` | ✅ | The `localStorage` key to bind to. **Locked on first render** — see [Immutable Keys](#immutable-keys) below. |
| `initialValue` | `T` |  | The value to use when the key doesn't exist in storage yet, and the value shown on the server / before hydration completes. |
| `options` | `UseLocalStorageOptions<T>` |  | Optional configuration object — see below. |

#### `options`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `serializer` | `StorageSerializer<T>` | JSON-based | Custom `serialize` / `deserialize` pair. Use a built-in preset or supply your own — see [Built-in Serializers](#built-in-serializers) and [Custom Serializers](#custom-serializers). |
| `initializeWithValue` | `boolean` | `true` | When `true`, `value` reflects storage as soon as the client is able to read it. Set to `false` to defer that and avoid even the brief post-hydration transition — see [SSR / Next.js Ready](#ssr--nextjs-ready). |
| `sameInstanceSync` | `boolean` | `true` | Keeps every hook instance sharing this key in sync **within the same tab**. |
| `crossInstanceSync` | `boolean` | `true` | Keeps the hook in sync when the same key changes **in another browser tab or window** on the same origin. |
| `onError` | `(error: Error) => void` | `undefined` | Called on every failed read, write, or key-change attempt — in every environment, including production. See [Error Handling](#error-handling). |

### Returns

| Property | Type | Description |
| :--- | :--- | :--- |
| `value` | `T \| undefined` | The current stored value, or `initialValue` when the key is absent. |
| `setValue` | `(valueOrUpdater: T \| ((prev: T \| undefined) => T)) => void` | Updates the stored value. Accepts a direct value **or an updater function**, just like the `useState` setter. |
| `removeValue` | `() => void` | Removes the key from storage and resets `value` back to `initialValue`. |
| `isHydrated` | `boolean` | `true` once the client has mounted and the hook has settled on its real, non-server value. Use this to gate SSR-sensitive rendering. |
| `error` | `Error \| null` | The most recent error the hook has encountered, or `null` when nothing has gone wrong. See [Error Handling](#error-handling) for the full picture. |

### Built-in Serializers

| Serializer | Handles | Notes |
| :--- | :--- | :--- |
| `defaultSerializer` | Primitives, plain objects, arrays | Used automatically when no `serializer` option is passed. |
| `mapSerializer<K, V>()` | `Map<K, V>` | `K` and `V` must be JSON-serializable. |
| `setSerializer<V>()` | `Set<V>` | `V` must be JSON-serializable. |
| `dateSerializer` | `Date` | Serializes via ISO 8601 string. |
| `bigIntSerializer` | `bigint` | Serializes as a numeric string. |

---

## Error Handling

`useLocalStorage` never throws. Every failure — a failed read, a failed write, an invalid key change — is caught internally and reported through three channels at once:

| Channel | Fires | Best for |
| :--- | :--- | :--- |
| `error` (return value) | Updated on every failure; reset to `null` on the next successful write or remove. | Reactively showing an inline error message in your UI. |
| `onError` (option) | Called once per failure, in every environment — including production builds. | Wiring up real error tracking (Sentry, your own telemetry, etc). |
| Console warning | Logged automatically whenever `process.env.NODE_ENV !== "production"`. | Catching mistakes during development. Silent in production. |

```tsx
const { value, setValue, error } = useLocalStorage("preferences", defaultPreferences, {
  onError: (err) => reportToErrorTracker(err),
});

if (error) {
  return <p role="alert">Couldn't save your preferences: {error.message}</p>;
}
```

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

By default, `useLocalStorage` is already hydration-safe — but if you'd rather avoid the brief flash from `initialValue` to the real stored value right after mount, defer the read explicitly with `initializeWithValue: false` and gate on `isHydrated`:

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

### Example 4: Handling Write Failures & Error Reporting

Combine `error` for inline UI feedback with `onError` for real error tracking — useful for something like an auth token, where a silent failure would be dangerous to miss.

```tsx
import { useLocalStorage } from "@himanshu-sorathiya/react-kit/storage";

function AuthTokenSync() {
  const { value: token, setValue: setToken, error } = useLocalStorage<string | null>(
    "auth-token",
    null,
    {
      onError: (err) => {
        // Fires in production too — wire this up to real telemetry.
        console.error("[auth-token] storage failed:", err);
      },
    },
  );

  return (
    <div>
      {error && <p role="alert">Session storage failed — you may be signed out on refresh.</p>}
      <button onClick={() => setToken(null)}>Sign out</button>
    </div>
  );
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
- Reporting storage failures to your error-tracking/observability pipeline via `onError`

---

## Gotchas & Edge Cases

### Same-Origin Only (Cross-Tab Sync)

`crossInstanceSync` relies on the browser's native `storage` event, which only fires between windows/tabs that share the exact same origin (protocol + host + port). Two tabs on `https://app.example.com` will sync with each other; a tab on `https://app.example.com` and one on `https://staging.example.com` — or even `http://app.example.com` — will not. This is a browser-level restriction the hook can't work around.

### Immutable Keys

The `key` argument is locked to whatever value it holds on the **first render** and cannot be changed dynamically afterward. If you pass a different `key` on a later render, the hook ignores it, keeps using the original key, and reports the mismatch — a console warning in development, and a call to `onError` if you've provided one (see [Error Handling](#error-handling)).

If your use case genuinely requires switching keys, don't pass a new `key` argument to the hook — instead, unmount and remount the component by changing React's own `key` prop on it, forcing a fresh hook instance to mount with the new storage key.

### Storage Quotas & Rollbacks

If a write exceeds the browser's storage quota (`QuotaExceededError`) — or a custom serializer throws while serializing — `setValue` never applies the update. Nothing is written, the value your component already has stays exactly as it was, and the failure is reported through `error`/`onError` (see [Error Handling](#error-handling)). Your component never ends up mid-write or in an inconsistent state.

### Custom Serializers

Need to persist a class instance or some other non-JSON-friendly structure? You're not limited to the built-in presets — pass any object implementing `{ serialize: (value) => string; deserialize: (raw) => value }` as the `serializer` option, and the hook will use it for every read and write.

---

## See Also

- [`useSessionStorage`](../useSessionStorage/README.md) — the same ergonomic API for temporary data that clears automatically when the tab closes.
- [`useEventListener`](../../events/useEventListener/README.md) — a general-purpose DOM/window event-binding hook, useful if you need to react to browser events elsewhere in your app.
