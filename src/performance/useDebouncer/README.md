# Debounce Hook Suite

A fully type-safe, purely synchronous debouncing ecosystem for React, built around a single **master execution engine** (`useDebouncer`) and three specialized **reactive wrappers** (`useDebouncedCallback`, `useDebouncedValue`, `useDebouncedState`) that adapt it to callbacks, values, and state.

One engine. Three shapes. Zero stale closures.

## Motivation (Why This Suite?)

Most debouncing utilities in the React ecosystem are one-off, single-purpose implementations: a `useDebouncedValue` here, a `debounce`-wrapped `useCallback` there, each with its own timer logic, its own edge-case bugs, and its own inconsistent option handling. This suite takes a different approach.

Every hook in this family — `useDebouncedCallback`, `useDebouncedValue`, and `useDebouncedState` — is a thin, purpose-built wrapper around one shared engine: **`useDebouncer`**. Think of `useDebouncer` as a **dynamic execution slot**: a single timer, a single set of leading/trailing/`maxWait` rules, and a mutable "next thing to run" reference that any part of your component can update at any time. The wrappers don't reimplement debounce logic — they just decide *what* gets fed into that slot and *how* the result is exposed back to your component (a callback, a lagging value, or a piece of local state).

This architecture pays off in two concrete ways:

1. **No stale closures, ever.** `useDebouncedCallback` stores your function in a `funcRef` that is refreshed on every render via `useEffect`. The debounced wrapper it returns always calls `funcRef.current` — meaning it always sees the freshest props and state, even though the wrapper itself was created several renders ago.
2. **No unnecessary timer thrashing.** Because the debounced function's *identity* only depends on `run` (which is itself stable unless `delay`, `maxWait`, `leading`, or `trailing` change), passing a brand-new inline function into `useDebouncedCallback` on every render does **not** tear down and recreate the underlying timer. Your pending debounce cycle survives parent re-renders untouched.

The result is a suite that is predictable under the exact conditions where hand-rolled debounce hooks usually fall apart: rapidly changing props, frequent re-renders, and functions that close over state.

## Import Syntax

```tsx
// Preferred
import {
	useDebouncer,
	useDebouncedCallback,
	useDebouncedValue,
	useDebouncedState,
	type UseDebouncerReturn,
	type UseDebouncedCallbackReturn,
	type UseDebouncedValueReturn,
	type UseDebouncedStateReturn,
	type DebounceOptions,
	type UseDebouncedStateOptions,
	type UseDebouncedValueOptions,
} from "@himanshu-sorathiya/react-kit/performance";
// Or
import {
	useDebouncer,
	useDebouncedCallback,
	useDebouncedValue,
	useDebouncedState,
	type UseDebouncerReturn,
	type UseDebouncedCallbackReturn,
	type UseDebouncedValueReturn,
	type UseDebouncedStateReturn,
	type DebounceOptions,
	type UseDebouncedStateOptions,
	type UseDebouncedValueOptions,
} from "@himanshu-sorathiya/react-kit";
```

## Master Hook Deep Dive (`useDebouncer`)

`useDebouncer(delay, options)` is the engine that powers every other hook in this suite. Conceptually, it holds onto a small amount of internal bookkeeping across renders:

- An **execution slot** — the most recently registered function and its arguments, waiting to be invoked.
- A **single timer handle**, cleared and re-armed on every call to `run()`.
- **Cycle timestamps**, used to detect whether a call starts a fresh cycle and to drive the `maxWait` ceiling.

None of this is exposed directly — it exists purely to make `run`, `cancel`, `flush`, and `isPending` behave correctly. Every call to `run(func, ...args)` registers `func`/`args` as the current occupant of the execution slot and resets the pending timer. This is the core design decision that gives the suite its most distinctive capability:

### The "Last-Write-Wins" Execution Swap

Because `run()` accepts a function argument *dynamically*, you are not locked into debouncing a single, fixed callback. You can send **completely different functions** into the same ongoing delay window, and whichever one arrives last is the one that fires when the timer finally elapses.

Concretely: if a user triggers a "Save" action, and then — before the debounce window closes — triggers a "Cancel" action, the execution slot doesn't queue both. It **swaps**. The "Save" logic is discarded entirely, and only the "Cancel" logic runs when the timer fires. This makes `useDebouncer` uniquely suited for orchestrating short-lived, mutually-exclusive intents (save vs. cancel, expand vs. collapse, confirm vs. undo) without any manual bookkeeping on your part. See [Example 1](#example-1-master-hook-dynamic-function-swapping) for a full walkthrough.

## API Reference

### `useDebouncer`

```ts
function useDebouncer(delay: number, options?: DebounceOptions): UseDebouncerReturn;
```

**Options (`DebounceOptions`)**

| Option | Type | Default | Description |
|---|---|---|---|
| `maxWait` | `number \| undefined` | `undefined` | Hard ceiling, in milliseconds, on how long execution can be deferred. If continuous calls to `run()` keep pushing the trailing timer out, `maxWait` forces an immediate synchronous invocation once the elapsed time since the current cycle began reaches this threshold. Only evaluated at the moment `run()` is called — it is not an independent background timer. |
| `leading` | `boolean` | `false` | When `true`, invokes the passed function immediately on the *first* call of a new debounce cycle (i.e., when no cycle is already active). |
| `trailing` | `boolean` | `true` | When enabled, invokes the most recently passed function once the `delay` window elapses without a new call. Defaults to `true` regardless of `leading`. If both `leading` and `trailing` are explicitly set to `false`, the debounced function will never run — see [`{ leading: false, trailing: false }` Means "Never"](#-leading-false-trailing-false--means-never). |

**Return payload (`UseDebouncerReturn`)**

| Property | Type | Description |
|---|---|---|
| `run` | `<Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => void` | Registers `func` (with `args`) as the current occupant of the execution slot and (re)starts/refreshes the debounce timer. Calling this again before the timer fires overwrites the pending function and arguments — see [Last-Write-Wins](#the-last-write-wins-execution-swap). |
| `cancel` | `() => void` | Clears the pending timer and wipes the execution slot (function, arguments, and timestamps) **without invoking anything**. Sets `isPending` back to `false`. |
| `flush` | `() => void` | If — and only if — there is a pending timer with a registered function and arguments, immediately invokes it, clears the timer, and resets the slot. If nothing is pending, this is a no-op. |
| `isPending` | `boolean` | `true` for as long as a trailing invocation is still scheduled to fire. Becomes `false` as soon as it's known nothing further will happen in the current cycle — for example, immediately after a leading-edge invocation if `trailing` is disabled, not merely once the full window elapses. Also `false` after `cancel()` or `flush()`. |

### Equality Comparator (`equalityFn`)

`useDebouncedState` and `useDebouncedValue` each accept one option beyond `DebounceOptions`: `equalityFn?: (previous: T, next: T) => boolean`. When the debounced value is about to be committed, `equalityFn` is called against the currently-held value and the incoming one; if it returns `true`, the commit is skipped entirely — no state update, no re-render. Defaults to `Object.is`. Useful when `T` is an object or array and you want to avoid a redundant re-render for values that are structurally equivalent but not the same reference. See [Example 2](#example-2-option-behaviors-matrix) for a worked example.

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
| `delay` | `number` | Passed straight through to `useDebouncer`. |
| `options` | `DebounceOptions` | Passed straight through to `useDebouncer`. |

**Returns**

| Property | Type | Description |
|---|---|---|
| `debouncedFunc` | `(...args: Args) => void` | A stable, debounced wrapper around `func`. Internally calls `run(funcRef.current, ...args)` on every invocation, guaranteeing the freshest closure is used regardless of when the wrapper was created. |
| `cancel` | `() => void` | See `useDebouncer`. |
| `flush` | `() => void` | See `useDebouncer`. |
| `isPending` | `boolean` | See `useDebouncer`. |

### `useDebouncedValue`

```ts
function useDebouncedValue<T>(
	value: T,
	delay: number,
	options?: UseDebouncedValueOptions<T>,
): [T, { isPending: boolean; cancel: () => void; flush: () => void }];
```

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `value` | `T` | The rapidly-changing source value to debounce (e.g., a controlled input's state). |
| `delay` | `number` | Passed straight through to `useDebouncer`. |
| `options` | `UseDebouncedValueOptions<T>` | `DebounceOptions` plus an optional `equalityFn` (see [above](#equality-comparator-equalityfn)). |

**Returns (tuple)**

| Index | Name | Type | Description |
|---|---|---|---|
| `[0]` | `debouncedValue` | `T` | The debounced (lagging) mirror of `value`. |
| `[1]` | utility object | `{ isPending, cancel, flush }` | Same semantics as the equivalent properties on `useDebouncer` / `useDebouncedCallback`, operating on the pending sync to the latest `value`. |

### `useDebouncedState`

```ts
function useDebouncedState<T>(
	initialValue: T | (() => T),
	delay: number,
	options?: UseDebouncedStateOptions<T>,
): [T, (value: T | ((previous: T) => T)) => void, {
	isPending: boolean;
	cancel: () => void;
	flush: () => void;
	forceSetValue: (value: T | ((previous: T) => T)) => void;
}];
```

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `initialValue` | `T \| (() => T)` | Initial value of the underlying state, or a `useState`-style lazy initializer function. |
| `delay` | `number` | Passed straight through to `useDebouncer`. |
| `options` | `UseDebouncedStateOptions<T>` | `DebounceOptions` plus an optional `equalityFn` (see [above](#equality-comparator-equalityfn)). |

**Returns (tuple)**

| Index | Name | Type | Description |
|---|---|---|---|
| `[0]` | `state` | `T` | The current (debounced) state value. |
| `[1]` | `setDebouncedState` | `(value: T \| ((previous: T) => T)) => void` | Schedules a debounced update to state. Accepts a plain value or a functional updater; functional updates correctly compose across multiple calls made before the debounce settles. |
| `[2]` | utility object | `{ isPending, cancel, flush, forceSetValue }` | `isPending`/`cancel`/`flush` behave as in `useDebouncer`, operating on the pending debounced update. `forceSetValue` bypasses debounce scheduling entirely and applies immediately — it also cancels any pending debounced update first, so that update can't land later and overwrite the forced value. |

## Ecosystem Examples

### Example 1: Master Hook Dynamic Function Swapping

```tsx
import { useDebouncer } from "@himanshu-sorathiya/react-kit/performance";

function DocumentActionBar() {
	const { run, isPending } = useDebouncer(1000);

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
import { useDebouncer } from "@himanshu-sorathiya/react-kit/performance";

function LiveSearchInput() {
	const { run } = useDebouncer(300, { maxWait: 1000 });

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
import { useDebouncer } from "@himanshu-sorathiya/react-kit/performance";

function SubmitButton() {
	const { run } = useDebouncer(2000, { leading: true, trailing: false });

	const handleClick = () => {
		run(() => console.log("Form submitted."));
	};

	return <button onClick={handleClick}>Submit</button>;
}
```

The first click fires immediately. Any further clicks within the following 2000ms are absorbed silently — `trailing: false` means no follow-up invocation happens, so a frantic double- or triple-click can never submit the form more than once.

**`equalityFn` — skipping redundant commits for non-primitive values**

```tsx
import { useDebouncedValue } from "@himanshu-sorathiya/react-kit/performance";

interface Coordinates {
	x: number;
	y: number;
}

function CursorTracker({ position }: { position: Coordinates }) {
	const [debouncedPosition] = useDebouncedValue(position, 200, {
		equalityFn: (previous, next) =>
			previous.x === next.x && previous.y === next.y,
	});

	// Without `equalityFn`, a new `{ x, y }` object on every render would
	// always be treated as "changed" even if the coordinates themselves
	// didn't move, causing an unnecessary re-render once the debounce settles.

	return (
		<div>
			Cursor at ({debouncedPosition.x}, {debouncedPosition.y})
		</div>
	);
}
```

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
	const [debouncedQuery] = useDebouncedValue(query, 350);

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

`flush()` immediately commits whatever the user last typed — useful for a "hard save" button that shouldn't wait out the remaining debounce window. `forceSetValue("")` bypasses the debounce mechanism entirely, resetting the field instantly, and cancels any debounced update that was still pending so it can't land afterward and undo the reset.

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

### `{ leading: false, trailing: false }` Means "Never"

If you configure both edges off, the debounced function will never run — there's no fallback or auto-correction for this. The suite respects your exact configuration rather than guessing at what you probably meant. A dev-mode warning is logged the moment this configuration is detected (see [Development Warnings](#development-warnings)), so the mistake — if it is one — surfaces immediately instead of manifesting as "my debounce silently does nothing" days later.

If you want the function to still fire under *some* condition, set at least one of `leading` or `trailing` to `true`.

### `useDebouncedValue`'s Return Shape

`useDebouncedValue` returns a tuple: `[debouncedValue, { isPending, cancel, flush }]` — the same utility controls as `useDebouncer` and `useDebouncedCallback`, scoped to the pending sync of the latest `value`. Reach for `useDebouncedState` instead when you need to *own* the state yourself (i.e., you want a setter, not just a mirror of an externally-changing value) — `useDebouncedValue` always tracks whatever `value` you pass in; it has no independent setter of its own.

### Automatic Lifecycle Cleanup

Every timer created by `useDebouncer` is torn down automatically inside a `useEffect` cleanup function tied to the hook's `cancel` reference. When the owning component unmounts, any pending debounce cycle is cancelled — there is no scenario in which this suite leaves a dangling `setTimeout` running against an unmounted component or leaks memory across remounts.

### Development Warnings

In non-production builds (`process.env.NODE_ENV !== "production"`), this suite logs `console.warn` diagnostics for common misconfigurations, all prefixed with the hook name that raised them. None of these change runtime behavior — they only surface information — and none of them log in production builds.

| Hook | Condition | What's logged |
|---|---|---|
| `useDebouncer` | `delay` is not a finite, non-negative number | Warns and reports the clamped fallback value used instead. |
| `useDebouncer` | `leading: false` and `trailing: false` together | Warns that the debounced function will never run. |
| `useDebouncer` | `maxWait` is smaller than `delay` | Warns that the function will fire on almost every call. |
| `useDebouncedCallback` | `func` is not a function | Warns with the actual received type. |
| `useDebouncedState` / `useDebouncedValue` | `equalityFn` is provided but isn't a function | Warns and falls back to `Object.is`. |

## See Also

- [`useThrottler`](../useThrottler/README.md) — the throttle-based counterpart to this suite: rate-limits activity as it happens instead of waiting for a pause before firing.
- [`useRateLimiter`](../useRateLimiter/README.md) — a stricter accept-or-reject alternative when you need a hard cap on how many times something can run per window, rather than reshaping *when* it runs.
- [`useBatcher`](../useBatcher/README.md) — groups every call into a batch instead of discarding intermediate ones, for when you need all the accumulated data, not just the latest value.
