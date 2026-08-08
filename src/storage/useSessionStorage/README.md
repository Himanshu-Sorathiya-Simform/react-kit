# `useSessionStorage`

An SSR-safe, same-tab synchronized React state hook for `sessionStorage` — purpose-built for temporary, tab-scoped data, with the same zero-effort serialization support for `Map`, `Set`, `Date`, and `BigInt` you get from `useLocalStorage`, and built-in error reporting for production and development alike.

`useSessionStorage` behaves like `useState`, except the value survives a page refresh, stays in sync across every component subscribed to the same key in that tab, and is automatically wiped the moment the tab closes.

```tsx
const { value, setValue, removeValue, isHydrated, error } = useSessionStorage("wizard-step", 1);
```

---

## Motivation (Why this hook?)

Not all persisted state should live forever. `useSessionStorage` solves the same handful of `sessionStorage`-in-React problems every project re-solves, so you don't have to — for the data that should only outlive a refresh, not the browser session itself.

### Tab-Isolated Persistence

Perfect for temporary data that needs to survive a page refresh but should cleanly disappear the moment the user closes the tab — draft form inputs, in-progress wizard steps, or anything else that shouldn't linger after the user is done. Unlike `localStorage`, nothing written here outlives the tab it was written in. See [Tab Isolation](#tab-isolation-browser-behavior) in Gotchas for exactly what "tab-scoped" means in practice.

### Same-Tab Synchronization

State written to a key by one component is a drop-in state sync for every other component reading that same key **within the same tab**. If Component A calls `setValue`, Component B instantly re-renders with the new value — no prop drilling, no context provider, no manual event wiring.

### Advanced Data Types, Handled Natively

`sessionStorage` can only store strings, which normally makes persisting a `Map`, `Set`, `Date`, or `BigInt` painful. `useSessionStorage` shares the exact same built-in serializers as `useLocalStorage`, so complex JS values round-trip safely with zero manual effort. See [Built-in Serializers](#built-in-serializers) below.

### SSR / Next.js Ready

Server-rendered apps have no access to `sessionStorage`, a classic source of hydration mismatch errors. `useSessionStorage` is hydration-safe **by default**: on the server, and during the client's very first render, `value` is always `initialValue` — guaranteed to match what the server sent, so React never reports a mismatch. Immediately after hydration, if the real stored value turns out to differ, the hook reconciles to it automatically. `isHydrated` and `initializeWithValue` give you precise control if you'd rather avoid even that brief transition — see [Example 3](#example-3-safe-ssr--nextjs-rendering).

### Robust Error Handling

Quota exceeded? Malformed JSON already sitting in storage? A custom serializer that throws? `useSessionStorage` never lets these become explosive runtime errors. Every failure is caught and reported through the `error` return value, an `onError` callback that fires in every environment (including production), and a console warning in development — see [Error Handling](#error-handling) below.

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
| `key` | `string` | ✅ | The `sessionStorage` key to bind to. **Locked on first render** — see [Immutable Keys](#immutable-keys) below. |
| `initialValue` | `T` |  | The value to use when the key doesn't exist in storage yet, and the value shown on the server / before hydration completes. |
| `options` | `UseSessionStorageOptions<T>` |  | Optional configuration object — see below. |

#### `options`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `serializer` | `StorageSerializer<T>` | JSON-based | Custom `serialize` / `deserialize` pair. Use a built-in preset or supply your own — see [Built-in Serializers](#built-in-serializers) and [Custom Serializers](#custom-serializers). |
| `initializeWithValue` | `boolean` | `true` | When `true`, `value` reflects storage as soon as the client is able to read it. Set to `false` to defer that and avoid even the brief post-hydration transition — see [SSR / Next.js Ready](#ssr--nextjs-ready). |
| `sameInstanceSync` | `boolean` | `true` | Keeps every hook instance sharing this key in sync **within the same tab**. |
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

`useSessionStorage` never throws. Every failure — a failed read, a failed write, an invalid key change — is caught internally and reported through three channels at once:

| Channel | Fires | Best for |
| :--- | :--- | :--- |
| `error` (return value) | Updated on every failure; reset to `null` on the next successful write or remove. | Reactively showing an inline error message in your UI. |
| `onError` (option) | Called once per failure, in every environment — including production builds. | Wiring up real error tracking (Sentry, your own telemetry, etc). |
| Console warning | Logged automatically whenever `process.env.NODE_ENV !== "production"`. | Catching mistakes during development. Silent in production. |

```tsx
const { value, setValue, error } = useSessionStorage("draft-comment", "", {
  onError: (err) => reportToErrorTracker(err),
});

if (error) {
  return <p role="alert">Couldn't save your draft: {error.message}</p>;
}
```

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

By default, `useSessionStorage` is already hydration-safe — but if you'd rather avoid the brief flash from `initialValue` to the real stored value right after mount, defer the read explicitly with `initializeWithValue: false` and gate on `isHydrated`:

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

### Example 4: Handling Write Failures & Error Reporting

Combine `error` for inline UI feedback with `onError` for real error tracking — useful for something like an in-progress checkout step, where a silent failure would be confusing for the user.

```tsx
import { useSessionStorage } from "@himanshu-sorathiya/react-kit/storage";

function CheckoutStep() {
  const { value: step, setValue: setStep, error } = useSessionStorage("checkout-step", 1, {
    onError: (err) => {
      // Fires in production too — wire this up to real telemetry.
      console.error("[checkout-step] storage failed:", err);
    },
  });

  return (
    <div>
      {error && <p role="alert">We couldn't save your progress — it may not survive a refresh.</p>}
      <button onClick={() => setStep((prev) => (prev ?? 1) + 1)}>Next step</button>
    </div>
  );
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
- Reporting storage failures to your error-tracking/observability pipeline via `onError`

---

## Gotchas & Edge Cases

### Tab Isolation (Browser Behavior)

`sessionStorage` is strictly bound to the active tab by the browser itself — this is not a limitation of the hook, it's the platform contract. Duplicating a tab or opening a link in a new tab creates a completely blank, isolated session; nothing written in the original tab will be visible there. If you need state that persists and syncs across multiple open tabs, reach for [`useLocalStorage`](../useLocalStorage/README.md) instead.

One narrower exception worth knowing about: same-origin iframes embedded within a single tab do technically share that tab's `sessionStorage` at the platform level, and the browser can fire `storage` events between them. This hook doesn't listen for those — `sameInstanceSync` only covers usage within the same window/frame — so two same-origin iframes on one page won't sync with each other through this hook. Unlikely to affect typical usage, but worth knowing if your app relies on same-origin iframes.

### Immutable Keys

The `key` argument is locked to whatever value it holds on the **first render** and cannot be changed dynamically afterward. If you pass a different `key` on a later render, the hook ignores it, keeps using the original key, and reports the mismatch — a console warning in development, and a call to `onError` if you've provided one (see [Error Handling](#error-handling)).

If your use case genuinely requires switching keys, don't pass a new `key` argument to the hook — instead, unmount and remount the component by changing React's own `key` prop on it, forcing a fresh hook instance to mount with the new storage key.

### Storage Quotas & Rollbacks

If a write exceeds the browser's storage quota (`QuotaExceededError`) — or a custom serializer throws while serializing — `setValue` never applies the update. Nothing is written, the value your component already has stays exactly as it was, and the failure is reported through `error`/`onError` (see [Error Handling](#error-handling)). Your component never ends up mid-write or in an inconsistent state.

### Custom Serializers

Need to persist a class instance or some other non-JSON-friendly structure? You're not limited to the built-in presets — pass any object implementing `{ serialize: (value) => string; deserialize: (raw) => value }` as the `serializer` option, and the hook will use it for every read and write.

---

## See Also

- [`useLocalStorage`](../useLocalStorage/README.md) — for permanent data persistence that survives closed tabs and syncs across all open tabs.
- [`useEventListener`](../../events/useEventListener/README.md) — a general-purpose DOM/window event-binding hook, useful if you need to react to browser events elsewhere in your app.
