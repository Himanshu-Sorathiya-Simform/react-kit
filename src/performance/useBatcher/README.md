# Batch Hook Suite

A fully type-safe, purely synchronous batching hook for React, built around a single hook: **`useBatcher`**. It accumulates rapid, individual calls into a group and flushes the whole group at once — the one hook in this repo's rate-control family that never discards anything.

## Motivation (Why this hook?)

Debounce keeps only the latest call. Throttle keeps only the most recent call per window. Rate-limit rejects anything past a budget. All three exist to _reduce_ how often something runs by discarding the calls in between. Batching solves a different, equally common problem: sometimes you don't want to discard anything — you want every call's data to eventually arrive, just grouped together so the downstream handler runs once instead of a hundred times.

Concretely: an analytics SDK doesn't want to drop 95% of your tracked events (that's what throttling would do) — it wants to collect them and ship them in batches of 20, or at least once every few seconds, whichever comes first. A batcher is the right tool for exactly that shape of problem: many independent, meaningful pieces of data that all need to arrive, but not necessarily as 100 separate network requests.

`useBatcher` deliberately doesn't split into the engine-plus-`Callback`/`State`/`Value` wrapper shape the debounce/throttle/rate-limit families use. That split exists there because those hooks have a natural "dynamic execution slot" — a different function can occupy the slot on every call. Batching doesn't have an equivalent: every item in a batch is always headed to the _same_ flush handler, so there's nothing to swap. Live access to what's currently queued — the thing a dedicated `State`/`Value` hook would otherwise provide — is available instead via the `onItemsChange` option, which you can wire into your own `useState` if you want a reactive view of the current batch.

## Import Syntax

```tsx
// Preferred
import {
	useBatcher,
	type UseBatcherReturn,
	type BatchOptions,
} from "@himanshu-sorathiya/react-kit/performance";
// Or
import {
	useBatcher,
	type UseBatcherReturn,
	type BatchOptions,
} from "@himanshu-sorathiya/react-kit";
```

## Deep Dive: The Three Flush Triggers

A batch flushes when the _first_ of its configured triggers fires. All three are optional, independent, and freely combinable — and if none are configured, the batch simply grows forever until you call `flush()` yourself.

- **`maxSize`** — flushes the instant the batch reaches this many items. Checked on every `add()`, before either timer is considered.
- **`maxWait`** — a hard ceiling, in milliseconds, measured from the _first_ item of the current batch. Guarantees no item waits longer than `maxWait` to be flushed, no matter how long the batch keeps growing. Armed once per batch and never pushed back by later items.
- **`quietPeriod`** — flushes once this many milliseconds pass with _no new items_ — resets on every single `add()` call. This is a fundamentally different question from `maxWait`: `maxWait` asks "how long has this batch existed," `quietPeriod` asks "how long has it been since the last item arrived."

Combining `maxWait` and `quietPeriod` is a genuinely useful pattern: `quietPeriod` lets a batch flush early once things settle down, while `maxWait` guarantees it flushes eventually even if items never stop arriving fast enough for `quietPeriod` to get a chance. If both are set and `quietPeriod` isn't meaningfully shorter than `maxWait`, `maxWait` will win almost every time — a dev-mode warning flags this.

### Pausing and Resuming

`pause()` suspends all three automatic triggers without touching the buffer — items added via `add()` while paused still accumulate normally, they just can't trigger an automatic flush. `resume()` re-arms the machinery: if the batch already exceeds `maxSize` (because items kept arriving while paused), it flushes immediately; otherwise, `maxWait`/`quietPeriod` restart from a fresh clock rather than picking up wherever they left off. Pausing genuinely stops time from advancing on the batch — resuming doesn't try to reconstruct how much progress was lost.

### Observing the Current Batch (`onItemsChange`)

Since there's no dedicated `State`/`Value` variant, `onItemsChange` is how you get a live view of what's currently queued:

```tsx
const [queued, setQueued] = useState<Item[]>([]);

const { add } = useBatcher<Item>(handleFlush, {
	maxSize: 10,
	onItemsChange: setQueued,
});
```

`queued` now mirrors the batch's contents in real time — grows on every `add()`, resets to `[]` on every flush or `cancel()` — without `useBatcher` itself needing to hold that array in state.

## API Reference

### `useBatcher(onFlush, options?)`

**Parameters**

| Parameter | Type                               | Description                                                                                                                                        |
| --------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onFlush` | `(items: readonly Item[]) => void` | Called with every item accumulated since the last flush. Safe to pass a fresh inline function on every render — captured in a ref, always current. |
| `options` | `BatchOptions<Item>` (optional)    | See below.                                                                                                                                         |

**`BatchOptions<Item>`**

| Option          | Type                                            | Default     | Description                                                                                                                                      |
| --------------- | ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `maxSize`       | `number \| undefined`                           | `undefined` | Flush once the batch reaches this many items. Invalid input (not a positive integer) is ignored, not clamped, with a dev-mode warning.           |
| `maxWait`       | `number \| undefined`                           | `undefined` | Flush at most this many milliseconds after the batch's first item. Invalid input (not a non-negative number) is ignored with a dev-mode warning. |
| `quietPeriod`   | `number \| undefined`                           | `undefined` | Flush once this many milliseconds pass with no new items. Resets on every `add()`. Invalid input is ignored with a dev-mode warning.             |
| `onItemsChange` | `(items: readonly Item[]) => void \| undefined` | `undefined` | Called with a snapshot of the batch contents after every `add()`, flush, or `cancel()`.                                                          |

**Return Value (`UseBatcherReturn<Item>`)**

| Property    | Type                   | Description                                                                                           |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `add`       | `(item: Item) => void` | Adds an item to the current batch. Always accepted — nothing is ever rejected or dropped.             |
| `flush`     | `() => void`           | Immediately flushes the current batch. No-op if empty.                                                |
| `cancel`    | `() => void`           | Discards the current batch without ever calling `onFlush`.                                            |
| `pause`     | `() => void`           | Suspends automatic flush triggers. Items can still be added.                                          |
| `resume`    | `() => void`           | Re-arms automatic flush triggers; flushes immediately if `maxSize` was already exceeded while paused. |
| `size`      | `number`               | Number of items currently in the batch.                                                               |
| `isPending` | `boolean`              | `true` whenever `size > 0`.                                                                           |
| `isPaused`  | `boolean`              | `true` after `pause()`, until the next `resume()`.                                                    |

## Ecosystem Examples

### Example 1: Batching Analytics Events by Size or Time

```tsx
import { useBatcher } from "@himanshu-sorathiya/react-kit/performance";

interface AnalyticsEvent {
	name: string;
	timestamp: number;
}

function useAnalytics() {
	const { add } = useBatcher<AnalyticsEvent>(
		(events) =>
			fetch("/api/analytics/batch", {
				method: "POST",
				body: JSON.stringify(events),
			}),
		{ maxSize: 20, maxWait: 5000 },
	);

	const track = (name: string) => add({ name, timestamp: Date.now() });

	return { track };
}
```

Events are grouped and sent in batches of up to 20 — or at least once every 5 seconds if fewer than 20 accumulate — instead of firing a network request per event.

### Example 2: `quietPeriod` — Grouping a Burst of Notifications

```tsx
import { useBatcher } from "@himanshu-sorathiya/react-kit/performance";

function useGroupedToasts() {
	const { add } = useBatcher<string>(
		(messages) => showToast(`${messages.length} new updates`, messages),
		{ quietPeriod: 300 },
	);

	return { notify: add };
}
```

If five `notify()` calls arrive within a fast burst, they're grouped into a single toast once 300ms of quiet passes — instead of five separate, overlapping toasts.

### Example 3: All Three Triggers Combined

```tsx
import { useBatcher } from "@himanshu-sorathiya/react-kit/performance";

function useLogShipper() {
	const { add } = useBatcher<string>(
		(lines) => fetch("/api/logs", { method: "POST", body: lines.join("\n") }),
		{
			maxSize: 100, // never let more than 100 lines accumulate
			maxWait: 10_000, // never let a line wait more than 10s to ship
			quietPeriod: 1000, // ship sooner if logging goes quiet for 1s
		},
	);

	return { log: add };
}
```

Whichever of the three conditions is met first triggers the flush — a hard size ceiling, a hard latency ceiling, and an early-exit for quiet periods, all active simultaneously.

### Example 4: Live Queue UI with `onItemsChange`

```tsx
import { useState } from "react";
import { useBatcher } from "@himanshu-sorathiya/react-kit/performance";

function UploadQueue() {
	const [queued, setQueued] = useState<File[]>([]);

	const { add, flush, size } = useBatcher<File>((files) => uploadFiles(files), {
		maxWait: 3000,
		onItemsChange: setQueued,
	});

	return (
		<div>
			<input
				type="file"
				onChange={(e) => e.target.files?.[0] && add(e.target.files[0])}
			/>
			<p>
				{size} file(s) queued: {queued.map((f) => f.name).join(", ")}
			</p>
			<button onClick={flush}>Upload Now</button>
		</div>
	);
}
```

### Example 5: `pause` / `resume`

```tsx
import { useEffect } from "react";
import { useBatcher } from "@himanshu-sorathiya/react-kit/performance";

function useOfflineAwareBatcher() {
	const { add, pause, resume, isPaused } = useBatcher<string>(
		(items) => sendToServer(items),
		{ maxSize: 10, maxWait: 5000 },
	);

	useEffect(() => {
		const handleOffline = () => pause();
		const handleOnline = () => resume();

		window.addEventListener("offline", handleOffline);
		window.addEventListener("online", handleOnline);

		return () => {
			window.removeEventListener("offline", handleOffline);
			window.removeEventListener("online", handleOnline);
		};
	}, [pause, resume]);

	return { add, isPaused };
}
```

Items keep accumulating while offline; nothing attempts to flush (and fail) until connectivity returns.

## Real-World Use Cases

- Batching analytics or telemetry events before sending, instead of one request per event
- Coalescing multiple rapid API mutations (e.g., several quick "add to cart" clicks) into a single bulk request
- Grouping WebSocket messages received in a burst before processing them together
- Shipping application logs in batches instead of one network call per log line
- Grouping multiple near-simultaneous toast/notification triggers into a single combined notification
- Batching DOM or canvas mutations queued from multiple sources before a single paint/update pass
- Accumulating multi-select or bulk-action UI state (checked items) before a single "apply" operation
- Coalescing GraphQL or REST requests fired from unrelated components into one combined request
- Buffering form-field validation results before running one combined validation pass
- Queuing file uploads and sending them as a single batch request instead of one per file

## Gotchas & Edge Cases

### No `Callback`/`State`/`Value` Split

Unlike debounce/throttle/rate-limit, there's only one hook here. `onFlush` is a single, fixed handler — there's no per-call "swap the function" behavior to warrant a low-level engine plus wrappers. If you need reactive access to the current batch's contents, use the `onItemsChange` option (see [Observing the Current Batch](#observing-the-current-batch-onitemschange)) rather than looking for a `useBatchedState`/`useBatchedValue` that doesn't exist.

### Automatic Lifecycle Cleanup Does Not Flush

Unmounting the owning component clears any pending `maxWait`/`quietPeriod` timers — but it does **not** flush whatever's still buffered. An in-progress batch is abandoned on unmount, the same way `cancel()` abandons it, not delivered the way you might expect from a "batching" hook. If guaranteed delivery matters (e.g., don't lose queued analytics events when navigating away), call `flush()` explicitly in your own cleanup logic before unmount, rather than relying on this hook to do it for you.

### `maxWait` Measures From the First Item, Not the Last

A batch under `maxWait` will flush based on how long _the batch itself_ has existed — not how long it's been since the most recent item arrived. If you want the opposite (flush based on recency of the last item), that's what `quietPeriod` is for. Combine both if you want the guarantees of each.

### `flush()` on an Empty Batch Is a No-Op

Calling `flush()` when nothing has been added does nothing — `onFlush` is never called with an empty array. This matters if you're calling `flush()` unconditionally from some outer trigger (e.g., on unmount, on a timer) rather than only when you know something's queued.

## Development Warnings

In non-production builds (`process.env.NODE_ENV !== "production"`), this hook logs `console.warn` diagnostics for common misconfigurations. None of these change runtime behavior, and none of them log in production builds.

| Condition                                                  | What's logged                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `onFlush` is not a function                                | Warns with the actual received type.                                                                |
| `maxSize` is provided but isn't a positive integer         | Warns and ignores it (not clamped to a fallback).                                                   |
| `maxWait` is provided but isn't a non-negative number      | Warns and ignores it.                                                                               |
| `quietPeriod` is provided but isn't a non-negative number  | Warns and ignores it.                                                                               |
| None of `maxSize`, `maxWait`, `quietPeriod` are configured | Warns that only manual `flush()` calls will ever empty the batch.                                   |
| `quietPeriod` is set and not shorter than `maxWait`        | Warns that `maxWait` will almost always win the race, making `quietPeriod` effectively unreachable. |
| `onItemsChange` is provided but isn't a function           | Warns and ignores the value.                                                                        |

## See Also

- [`useDebouncer`](../useDebouncer/README.md) — waits for a pause in activity and keeps only the latest call, rather than grouping every call together.
- [`useThrottler`](../useThrottler/README.md) — reshapes _when_ activity fires at a steady cadence, discarding intermediate calls, rather than preserving and grouping them.
- [`useRateLimiter`](../useRateLimiter/README.md) — rejects calls outright once a budget is spent, rather than grouping the excess for later delivery.
