# Debounce Hook Suite

A fully type-safe, strictly client-side debouncing ecosystem for React, built around a single **master execution engine** (`useDebounce`) and three specialized **reactive wrappers** (`useDebouncedCallback`, `useDebouncedValue`, `useDebouncedState`) that adapt it to callbacks, values, and state.

One engine. Three shapes. Zero stale closures.

## Motivation (Why This Suite?)

Most debouncing utilities in the React ecosystem are one-off, single-purpose implementations: a `useDebouncedValue` here, a `debounce`-wrapped `useCallback` there, each with its own timer logic, its own edge-case bugs, and its own inconsistent option handling. This suite takes a different approach.

Every hook in this family — `useDebouncedCallback`, `useDebouncedValue`, and `useDebouncedState` — is a thin, purpose-built wrapper around one shared engine: **`useDebounce`**. Think of `useDebounce` as a **dynamic execution slot**: a single timer, a single set of leading/trailing/`maxWait` rules, and a mutable "next thing to run" reference that any part of your component can update at any time. The wrappers don't reimplement debounce logic — they just decide *what* gets fed into that slot and *how* the result is exposed back to your component (a callback, a lagging value, or a piece of local state).

This architecture pays off in two concrete ways:

1. **No stale closures, ever.** `useDebouncedCallback` stores your function in a `funcRef` that is refreshed on every render via `useEffect`. The debounced wrapper it returns always calls `funcRef.current` — meaning it always sees the freshest props and state, even though the wrapper itself was created several renders ago.
2. **No unnecessary timer thrashing.** Because the debounced function's *identity* only depends on `run` (which is itself stable unless `delay`, `maxWait`, `leading`, or `trailing` change), passing a brand-new inline function into `useDebouncedCallback` on every render does **not** tear down and recreate the underlying timer. Your pending debounce cycle survives parent re-renders untouched.

The result is a suite that is predictable under the exact conditions where hand-rolled debounce hooks usually fall apart: rapidly changing props, frequent re-renders, and functions that close over state.

## Import Syntax

```tsx
// Preferred
import {
	useDebounce,
	useDebouncedCallback,
	useDebouncedValue,
	useDebouncedState,
	type UseDebounceReturn,
	type UseDebouncedCallbackReturn,
	type UseDebouncedValueReturn,
	type UseDebouncedStateReturn,
	type DebounceOptions,
} from "@himanshu-sorathiya/react-kit/performance";
// Or
import {
	useDebounce,
	useDebouncedCallback,
	useDebouncedValue,
	useDebouncedState,
	type UseDebounceReturn,
	type UseDebouncedCallbackReturn,
	type UseDebouncedValueReturn,
	type UseDebouncedStateReturn,
	type DebounceOptions,
} from "@himanshu-sorathiya/react-kit";
```

## Master Hook Deep Dive (`useDebounce`)

`useDebounce(delay, options)` is the engine that powers every other hook in this suite. Structurally, it holds:

- **`activeFuncRef`** — a mutable reference to whichever function was most recently handed to `run()`.
- **`lastArgsRef`** — the arguments that should accompany that function when it finally executes.
- **`timerIdRef`** — the handle for the single active `setTimeout`, cleared and re-armed on every call to `run()`.
- **`lastInvokeTimeRef`** / **`lastCallTimeRef`** — timestamps used to drive the leading-edge check and the `maxWait` ceiling.

Every call to `run(func, ...args)` overwrites `activeFuncRef` and `lastArgsRef` and then resets the pending timer. This is the core design decision that gives the suite its most distinctive capability:

### The "Last-Write-Wins" Execution Swap

Because `run()` accepts a function argument *dynamically*, you are not locked into debouncing a single, fixed callback. You can send **completely different functions** into the same ongoing delay window, and whichever one arrives last is the one that fires when the timer finally elapses.

Concretely: if a user triggers a "Save" action, and then — before the debounce window closes — triggers a "Cancel" action, the execution slot doesn't queue both. It **swaps**. The "Save" logic is discarded entirely, and only the "Cancel" logic runs when the timer fires. This makes `useDebounce` uniquely suited for orchestrating short-lived, mutually-exclusive intents (save vs. cancel, expand vs. collapse, confirm vs. undo) without any manual bookkeeping on your part. See [Example 1](#example-1-master-hook-dynamic-function-swapping) for a full walkthrough.

## API Reference

### `useDebounce`

```ts
function useDebounce(delay: number, options?: DebounceOptions): UseDebounceReturn;
```

**Options (`DebounceOptions`)**

| Option | Type | Default | Description |
|---|---|---|---|
| `maxWait` | `number \| undefined` | `undefined` | Hard ceiling, in milliseconds, on how long execution can be deferred. If continuous calls to `run()` keep pushing the trailing timer out, `maxWait` forces an immediate synchronous invocation once the elapsed time since the last invoke reaches this threshold. Only evaluated at the moment `run()` is called — it is not an independent background timer. |
| `leading` | `boolean` | `false` | When `true`, invokes the passed function immediately on the *first* call of a new debounce cycle (i.e., when no cycle is already active). |
| `trailing` | `boolean` | `true` when `leading` is `false`; `false` when `leading` is `true` (unless explicitly overridden) | When enabled, invokes the most recently passed function once the `delay` window elapses without a new call. See the [Config Fallback Safety Valve](#the-config-fallback-safety-valve) for the one case where this is forced back to `true` regardless of what you pass. |

**Return payload (`UseDebounceReturn`)**

| Property | Type | Description |
|---|---|---|
| `run` | `<Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => void` | Registers `func` (with `args`) as the current occupant of the execution slot and (re)starts/refreshes the debounce timer. Calling this again before the timer fires overwrites the pending function and arguments — see [Last-Write-Wins](#the-last-write-wins-execution-swap). |
| `cancel` | `() => void` | Clears the pending timer and wipes the execution slot (function, arguments, and timestamps) **without invoking anything**. Sets `isPending` back to `false`. |
| `flush` | `() => void` | If — and only if — there is a pending timer with a registered function and arguments, immediately invokes it, clears the timer, and resets the slot. If nothing is pending, this is a no-op. |
| `isPending` | `boolean` | `true` for the entire duration of an active debounce cycle — including the period *after* a leading-edge invocation has already fired, since the trailing window is still open. Becomes `false` once the cycle resolves (via trailing invoke, `maxWait` invoke, `cancel()`, or `flush()`). |

### `useDebouncedCallback`

```ts
function useDebouncedCallback<Args extends unknown[]>(
	func: (...args: Args) => void,
	delay: number,
	options?: DebounceOptions,
): UseDebouncedCallbackReturn<Args>;
```

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `func` | `(...args: Args) => void` | The function to debounce. Safe to pass a fresh inline closure on every render — it's captured in a ref and never causes the underlying timer to reset. |
| `delay` | `number` | Passed straight through to `useDebounce`. |
| `options` | `DebounceOptions` | Passed straight through to `useDebounce`. |

**Returns**

| Property | Type | Description |
|---|---|---|
| `debouncedFunc` | `(...args: Args) => void` | A stable, debounced wrapper around `func`. Internally calls `run(funcRef.current, ...args)` on every invocation, guaranteeing the freshest closure is used regardless of when the wrapper was created. |
| `cancel` | `() => void` | See `useDebounce`. |
| `flush` | `() => void` | See `useDebounce`. |
| `isPending` | `boolean` | See `useDebounce`. |

### `useDebouncedValue`

```ts
function useDebouncedValue<T>(value: T, delay: number, options?: DebounceOptions): T;
```

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `value` | `T` | The rapidly-changing source value to debounce (e.g., a controlled input's state). |
| `delay` | `number` | Passed straight through to `useDebounce`. |
| `options` | `DebounceOptions` | Passed straight through to `useDebounce`. |

**Returns**

| Type | Description |
|---|---|
| `T` | The debounced value only. Internally, an effect re-runs a debounced setter every time `value` changes, and this hook returns the resulting lagging state directly — no utility object attached. |

### `useDebouncedState`

```ts
function useDebouncedState<T>(
	initialValue: T,
	delay: number,
	options?: DebounceOptions,
): [T, (value: T) => void, {
	isPending: boolean;
	cancel: () => void;
	flush: () => void;
	forceSetValue: (value: T) => void;
}];
```

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `initialValue` | `T` | Initial value of the underlying state. |
| `delay` | `number` | Passed straight through to `useDebounce`. |
| `options` | `DebounceOptions` | Passed straight through to `useDebounce`. |

**Returns (tuple)**

| Index | Name | Type | Description |
|---|---|---|---|
| `[0]` | `state` | `T` | The current (debounced) state value. |
| `[1]` | `setDebouncedState` | `(value: T) => void` | Schedules a debounced update to state. Repeated calls follow standard `useDebounce` scheduling rules. |
| `[2]` | utility object | `{ isPending, cancel, flush, forceSetValue }` | `isPending` and `cancel`/`flush` behave exactly as in `useDebounce`, operating on the pending debounced update. `forceSetValue` is the raw, un-debounced `setState` — it bypasses the debounce mechanism entirely and updates state immediately. |

## Ecosystem Examples

### Example 1: Master Hook Dynamic Function Swapping

```tsx
import { useDebounce } from "@himanshu-sorathiya/react-kit/performance";

function DocumentActionBar() {
	const { run, isPending } = useDebounce(1000);

	const handleSave = () => {
		run((message: string) => console.log(message), "Document saved to server.");
	};

	const handleCancel = () => {
		run((message: string) => console.log(message), "Save operation cancelled.");
	};

	return (
		<div>
			<button onClick={handleSave}>Save</button>
			<button onClick={handleCancel}>Cancel</button>
			{isPending && <span>Pending…</span>}
		</div>
	);
}
```

If a user clicks **Save** and then clicks **Cancel** within the same 1000ms window, only `"Save operation cancelled."` is ever logged. The `Cancel` call overwrites the execution slot that `Save` occupied — the earlier function is discarded, not queued.

### Example 2: Option Behaviors Matrix

**`maxWait` — guaranteeing execution under heavy continuous typing**

```tsx
import type { ChangeEvent } from "react";
import { useDebounce } from "@himanshu-sorathiya/react-kit/performance";

function LiveSearchInput() {
	const { run } = useDebounce(300, { maxWait: 1000 });

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		const query = e.target.value;
		run((q: string) => console.log("Searching for:", q), query);
	};

	return <input onChange={handleChange} placeholder="Search…" />;
}
```

Every keystroke resets the 300ms trailing timer. Without `maxWait`, a user who never pauses for 300ms could type indefinitely without triggering a single search. `maxWait: 1000` guarantees a search fires at least once every second, regardless of how continuously the user types.

**`leading: true` — click-burst button protection**

```tsx
import { useDebounce } from "@himanshu-sorathiya/react-kit/performance";

function SubmitButton() {
	const { run } = useDebounce(2000, { leading: true, trailing: false });

	const handleClick = () => {
		run(() => console.log("Form submitted."));
	};

	return <button onClick={handleClick}>Submit</button>;
}
```

The first click fires immediately. Any further clicks within the following 2000ms are absorbed silently — `trailing: false` means no follow-up invocation happens, so a frantic double- or triple-click can never submit the form more than once.

**The safety-valve config fallback**

```tsx
import { useDebounce } from "@himanshu-sorathiya/react-kit/performance";

function MisconfiguredButExplainedExample() {
	// Attempting to silence BOTH edges of the debounce cycle...
	const { run } = useDebounce(500, { leading: false, trailing: false });

	const handleTrigger = () => {
		// The hook internally overrides this back to `trailing: true`,
		// so the callback still fires 500ms after the last call.
		run(() => console.log("This still runs — the safety valve caught it."));
	};

	return <button onClick={handleTrigger}>Trigger</button>;
}
```

See [The Config Fallback Safety Valve](#the-config-fallback-safety-valve) below for why this is intentional, not a bug.

### Example 3: `useDebouncedCallback`

```tsx
import { useDebouncedCallback } from "@himanshu-sorathiya/react-kit/performance";

function SearchBox() {
	const { debouncedFunc: handleSearch, isPending } = useDebouncedCallback(
		(query: string) => console.log("Fetching results for:", query),
		400,
	);

	return (
		<div>
			<input onChange={(e) => handleSearch(e.target.value)} placeholder="Search…" />
			{isPending && <span>Typing…</span>}
		</div>
	);
}
```

### Example 4: `useDebouncedValue`

```tsx
import { useState } from "react";
import { useDebouncedValue } from "@himanshu-sorathiya/react-kit/performance";

function ProductFilterField() {
	const [query, setQuery] = useState("");
	const debouncedQuery = useDebouncedValue(query, 350);

	// `debouncedQuery` only updates 350ms after the user stops typing,
	// making it a safe dependency for an expensive filter/fetch effect.

	return (
		<input
			value={query}
			onChange={(e) => setQuery(e.target.value)}
			placeholder="Filter products…"
		/>
	);
}
```

### Example 5: `useDebouncedState`

```tsx
import { useDebouncedState } from "@himanshu-sorathiya/react-kit/performance";

function NoteEditor() {
	const [note, setNote, { isPending, flush, forceSetValue }] = useDebouncedState("", 800);

	return (
		<div>
			<textarea onChange={(e) => setNote(e.target.value)} />
			<p>Committed value: {note}</p>
			{isPending && <span>Unsaved changes…</span>}
			<button onClick={() => flush()}>Save Now</button>
			<button onClick={() => forceSetValue("")}>Reset</button>
		</div>
	);
}
```

`flush()` immediately commits whatever the user last typed — useful for a "hard save" button that shouldn't wait out the remaining debounce window. `forceSetValue("")` bypasses the debounce mechanism entirely, resetting the field instantly.

## Real-World Use Cases

- Auto-saving a text document or note to the backend as the user types
- Search-as-you-type autocomplete, throttling network requests to a typeahead endpoint
- Window-resize reflow inhibition, avoiding layout recalculation on every `resize` event
- Guarding form submit buttons against rapid double- or triple-click submissions
- Infinite-scroll pagination triggers, debouncing the scroll-event listener before firing a fetch
- Canvas or SVG drag/resize handlers, batching layout updates instead of recomputing on every pointer-move
- Live in-memory table or list filtering as a user types into a filter/search field
- Debounced field-level validation (e.g., username-availability checks) that waits for typing to pause
- Batching high-frequency telemetry or analytics events before dispatching them
- Debounced "typing…" indicator dispatch in chat interfaces, avoiding flooding a websocket connection

## Gotchas & Edge Cases

### The Config Fallback Safety Valve

If you configure `{ leading: false, trailing: false }` (or omit `leading` and simply pass `trailing: false` on its own), the hook detects that **no edge is left to fire on** — a configuration that would otherwise cause every scheduled execution to silently vanish with nothing ever running. Rather than allow that dead end, the hook defensively falls back to `trailing: true` in this specific case. Your function will still execute, on the trailing edge, exactly as if `trailing` had been left unset. This only applies when `leading` is `false`; a `{ leading: true, trailing: false }` configuration (leading-only) is left untouched, since that combination is a valid, intentional configuration on its own.

### `useDebouncedValue` Isolation

`useDebouncedValue` intentionally returns only the raw debounced value (`T`) — no `cancel`, `flush`, or `isPending` are exposed. This keeps the hook's call site as close as possible to a plain `useState` read. If your use case needs to interrupt a pending update, force an immediate value, or inspect pending status, `useDebouncedValue` is the wrong tool — reach for `useDebouncedState` instead, which exposes the full utility object alongside the value.

### Automatic Lifecycle Cleanup

Every timer created by `useDebounce` is torn down automatically inside a `useEffect` cleanup function tied to the hook's `cancel` reference. When the owning component unmounts, any pending debounce cycle is cancelled — there is no scenario in which this suite leaves a dangling `setTimeout` running against an unmounted component or leaks memory across remounts.

## See Also

- **[useFuzzySearch](../../state/useFuzzySearch/README.md)** — Pairs naturally with this suite: debounce a raw query input first, then hand the settled value to `useFuzzySearch` so the (comparatively expensive) fuzzy-sort pass only runs once the user has paused typing, instead of on every keystroke.
- **[useFilter](../../state/useFilter/README.md)** — Declarative list/array filtering utilities, commonly driven by a `useDebouncedValue`-wrapped search term to avoid re-filtering large datasets on every keystroke.
- **[useVisibility](../../ui/useVisibility/README.md)** — Intersection- and viewport-visibility tracking, often combined with this suite's `maxWait`-aware debouncing to throttle visibility-driven layout work.
