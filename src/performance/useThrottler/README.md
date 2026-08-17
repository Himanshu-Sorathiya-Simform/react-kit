# Throttle Hook Suite

A fully type-safe, purely synchronous throttling ecosystem for React, built around a single **master execution engine** (`useThrottler`) and three specialized **reactive wrappers** (`useThrottledCallback`, `useThrottledValue`, `useThrottledState`) that adapt it to callbacks, values, and state.

Every hook in the suite shares the exact same timing engine underneath, so behavior is 100% consistent no matter which layer of your UI you're throttling — from raw event handlers to derived state.

## Motivation (Why this suite?)

Most throttle implementations bolt rate-limiting logic directly onto whatever they're throttling — a callback gets its own timer, a value gets its own timer, and keeping their edge-case behavior (leading fire, trailing fire, cancellation) consistent across a codebase becomes a maintenance burden. This suite takes a different approach: **there is exactly one throttling engine, `useThrottler`, and everything else is a thin adapter over it.**

`useThrottler` doesn't own a specific function. Instead, it exposes a `run(func, ...args)` execution slot — you decide, on every single call, which function and arguments should occupy that slot. This is what makes it a true **engine** rather than a single-purpose utility: the timing logic is completely decoupled from *what* gets throttled.

`useThrottledCallback` builds on top of that engine by wrapping your function in a `funcRef`. Rather than re-creating the throttle timer whenever your callback's identity changes across renders (a common source of bugs and wasted timers in hand-rolled throttle hooks), the ref is silently updated in a `useEffect` on every render. The `run` slot always calls `funcRef.current`, so:

- **Stale closures are structurally impossible.** The function invoked at the trailing edge is always the most recently rendered version — never a snapshot captured when the timer started.
- **Background timers never thrash.** Because the throttled wrapper (`throttledFunc`) is memoized against `run` alone (not against your raw `func`), passing a new inline function on every parent render does not tear down and restart the underlying timer. The cooldown window keeps counting down uninterrupted.

`useThrottledValue` and `useThrottledState` are, in turn, just `useThrottledCallback` wired into `useState` — proving the same engine scales cleanly from "throttle this function call" all the way up to "throttle this piece of reactive state."

## Import Syntax

```tsx
// Preferred
import {
	useThrottler,
	useThrottledCallback,
	useThrottledValue,
	useThrottledState,
	type UseThrottlerReturn,
	type UseThrottledCallbackReturn,
	type UseThrottledValueReturn,
	type UseThrottledStateReturn,
	type ThrottleOptions,
	type UseThrottledStateOptions,
	type UseThrottledValueOptions,
} from "@himanshu-sorathiya/react-kit/performance";
// Or
import {
	useThrottler,
	useThrottledCallback,
	useThrottledValue,
	useThrottledState,
	type UseThrottlerReturn,
	type UseThrottledCallbackReturn,
	type UseThrottledValueReturn,
	type UseThrottledStateReturn,
	type ThrottleOptions,
	type UseThrottledStateOptions,
	type UseThrottledValueOptions,
} from "@himanshu-sorathiya/react-kit";
```

## Master Hook Deep Dive (`useThrottler`)

`useThrottler` is the foundation every other hook in this suite is built on. It does not know or care what function you're throttling — it only manages **one thing**: a single cooldown window that a function and its arguments can occupy at any given moment.

```ts
function useThrottler(delay: number, options?: ThrottleOptions): UseThrottlerReturn;
```

Conceptually, it holds onto a small amount of internal bookkeeping across renders — an **execution slot** for whichever function/arguments were most recently registered, a **single timer handle**, and a timestamp marking the most recent invocation, used both to detect whether the cooldown window has fully elapsed and to keep a continuous stream of calls firing at a steady cadence. None of this is exposed directly — it exists purely to make `run`, `cancel`, `flush`, and `isPending` behave correctly. Every call to `run()` updates that shared slot — it never spins up a second, parallel timer.

### Last-Write-Wins execution swapping

Because `run()` accepts the function to invoke *at call time* rather than binding to one function up front, you can pass **completely different functions** into the same ongoing cooldown window:

```ts
run(saveDraft, draftId);
// ...50ms later, still inside the cooldown window...
run(saveFinal, draftId); // this is the one that will actually fire
```

If both calls land inside the same throttle window, only one trailing invocation ever fires — and it's always the **most recent** function/argument pair passed to `run()`, regardless of what was passed earlier in that window. Earlier requests aren't queued or batched; they're simply superseded. This "Last-Write-Wins" behavior is what lets a single `useThrottler` instance safely back multiple event types or UI branches without any manual coordination.

### Leading and Trailing Defaults

Both `leading` and `trailing` default to `true`. With the defaults in place:

- The **first** call in a cooldown window fires **immediately** (the leading edge).
- If additional `run()` calls arrive while that cooldown is still active, none of them fire right away — but the **last** one received before the window closes fires automatically once the delay elapses (the trailing edge).

This gives you both instant feedback on the first interaction and a guarantee that the final state is never silently dropped. You can tune this per use case:

- `{ trailing: false }` — strict leading-edge rate-limiting. Only the first call per window ever executes; everything else inside the window is discarded.
- `{ leading: false }` — pure trailing-edge debounced-style throttling. Nothing fires until the window closes, at which point the most recent call executes.
- Leaving both at their `true` defaults — the most common configuration — gives you immediate response *and* eventual consistency.

## API Reference

### `useThrottler` — Options

| Option     | Type      | Default | Description                                                                 |
| ---------- | --------- | ------- | ----------------------------------------------------------------------------- |
| `delay`    | `number`  | —       | Required. Length of the cooldown window, in milliseconds.                    |
| `leading`  | `boolean` | `true`  | Fire immediately on the first call of a new cooldown window.                 |
| `trailing` | `boolean` | `true`  | Fire once more at the end of the window using the most recent function/args. |

> If both `leading` and `trailing` are explicitly set to `false`, the throttled function will never run — the suite respects this exact configuration rather than correcting it for you. See [`{ leading: false, trailing: false }` Means "Never"](#-leading-false-trailing-false--means-never) below.

### `useThrottler` — Return Value

| Property    | Type                                                              | Description                                                              |
| ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `run`       | `<Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => void` | Occupies the execution slot with `func` and `args`, subject to throttling.  |
| `cancel`    | `() => void`                                                       | Immediately clears any pending trailing invocation and resets the window.    |
| `flush`     | `() => void`                                                       | Immediately invokes the pending trailing call (if one is queued).       |
| `isPending` | `boolean`                                                           | `true` for as long as a trailing invocation is still scheduled to fire — not merely while the cooldown window is running. |

### Equality Comparator (`equalityFn`)

`useThrottledState` and `useThrottledValue` each accept one option beyond `ThrottleOptions`: `equalityFn?: (previous: T, next: T) => boolean`. When the throttled value is about to be committed, `equalityFn` is called against the currently-held value and the incoming one; if it returns `true`, the commit is skipped entirely — no state update, no re-render. Defaults to `Object.is`. Useful when `T` is an object or array and you want to avoid a redundant re-render for values that are structurally equivalent but not the same reference. See [Example 2](#example-2-option-behaviors-matrix) for a worked example.

### `useThrottledCallback`

```ts
function useThrottledCallback<Args extends unknown[]>(
	func: (...args: Args) => void,
	delay: number,
	options?: ThrottleOptions,
): UseThrottledCallbackReturn<Args>;
```

**Parameters**

| Parameter | Type                          | Description                                                              |
| --------- | ----------------------------- | -------------------------------------------------------------------------- |
| `func`    | `(...args: Args) => void`     | The function to throttle. Always invoked via a live ref — never stale.  |
| `delay`   | `number`                      | Cooldown window, in milliseconds.                                       |
| `options` | `ThrottleOptions` (optional)  | `leading` / `trailing` config, identical semantics to `useThrottler`.    |

**Return Value**

| Property        | Type                       | Description                                             |
| --------------- | -------------------------- | ---------------------------------------------------------- |
| `throttledFunc` | `(...args: Args) => void`  | Stable, throttled wrapper around `func`.                |
| `cancel`        | `() => void`               | Cancels a pending trailing call.                         |
| `flush`         | `() => void`               | Immediately runs a pending trailing call.                |
| `isPending`     | `boolean`                  | `true` while a trailing call is queued.                  |

### `useThrottledValue`

```ts
function useThrottledValue<T>(
	value: T,
	delay: number,
	options?: UseThrottledValueOptions<T>,
): [T, { isPending: boolean; cancel: () => void; flush: () => void }];
```

**Parameters**

| Parameter | Type                          | Description                                             |
| --------- | ----------------------------- | ----------------------------------------------------------- |
| `value`   | `T`                            | The fast-changing source value to throttle.              |
| `delay`   | `number`                       | Cooldown window, in milliseconds.                        |
| `options` | `UseThrottledValueOptions<T>` (optional) | `ThrottleOptions` plus an optional `equalityFn` (see [above](#equality-comparator-equalityfn)). |

**Returns (tuple)**

| Index | Name | Type | Description |
|---|---|---|---|
| `[0]` | `throttledValue` | `T` | The throttled (rate-limited) mirror of `value`. |
| `[1]` | utility object | `{ isPending, cancel, flush }` | Same semantics as the equivalent properties on `useThrottler` / `useThrottledCallback`, operating on the pending sync to the latest `value`. |

### `useThrottledState`

```ts
function useThrottledState<T>(
	initialValue: T | (() => T),
	delay: number,
	options?: UseThrottledStateOptions<T>,
): [T, (value: T | ((previous: T) => T)) => void, {
	isPending: boolean;
	cancel: () => void;
	flush: () => void;
	forceSetValue: (value: T | ((previous: T) => T)) => void;
}];
```

**Parameters**

| Parameter      | Type                          | Description                                                                 |
| -------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `initialValue` | `T \| (() => T)`               | Initial state, or a lazy initializer function (evaluated once, like `useState`). |
| `delay`        | `number`                       | Cooldown window, in milliseconds.                                            |
| `options`      | `UseThrottledStateOptions<T>` (optional) | `ThrottleOptions` plus an optional `equalityFn` (see [above](#equality-comparator-equalityfn)). |

**Returns (tuple)**

| Index                    | Type                       | Description                                                    |
| ------------------------- | -------------------------- | ------------------------------------------------------------------ |
| `[0]` — state             | `T`                         | The current (throttled) state value.                          |
| `[1]` — setThrottledState | `(value: T \| ((previous: T) => T)) => void` | Throttled state setter. Accepts a plain value or a functional updater; functional updates correctly compose across multiple calls made before the window settles. |
| `[2]` — `utils.isPending`     | `boolean`                   | `true` while an update is queued.                              |
| `[2]` — `utils.cancel`        | `() => void`                | Cancels a pending update.                                      |
| `[2]` — `utils.flush`         | `() => void`                | Immediately applies a pending update.                          |
| `[2]` — `utils.forceSetValue` | `(value: T \| ((previous: T) => T)) => void` | Bypasses throttling entirely and sets state immediately. Also cancels any throttled update that was still pending, so it can't land afterward and overwrite the forced value. |

## Ecosystem Examples

### Example 1: Master Hook Dynamic Function Swapping

`useThrottler` doesn't lock you into a single function — different event types can share the same throttle slot, and whichever one lands last before the trailing edge is the one that runs.

```tsx
import { useThrottler } from "@himanshu-sorathiya/react-kit/performance";

function ActivityLogger() {
	const { run, isPending } = useThrottler(1000);

	const logMouseMove = (x: number, y: number) => {
		console.log("mouse", x, y);
	};

	const logKeyPress = (key: string) => {
		console.log("key", key);
	};

	return (
		<div
			onMouseMove={(e) => run(logMouseMove, e.clientX, e.clientY)}
			onKeyDown={(e) => run(logKeyPress, e.key)}
		>
			{isPending ? "Recording..." : "Idle"}
		</div>
	);
}

export { ActivityLogger };
```

### Example 2: Option Behaviors Matrix

**Strict leading-edge vs. guaranteed trailing delivery**

```tsx
import { useThrottler } from "@himanshu-sorathiya/react-kit/performance";

function RateLimitDemo() {
	// Strict leading-edge: fires instantly, then ignores every call
	// that arrives before the 2s window closes.
	const strict = useThrottler(2000, { leading: true, trailing: false });

	// Guaranteed trailing: nothing fires until the window closes, at
	// which point the most recent call always executes.
	const guaranteed = useThrottler(2000, { leading: false, trailing: true });

	const handleClick = () => {
		strict.run(() => console.log("strict: fired"));
		guaranteed.run(() => console.log("guaranteed: fired"));
	};

	return <button onClick={handleClick}>Fire both</button>;
}

export { RateLimitDemo };
```

**`equalityFn` — skipping redundant commits for non-primitive values**

```tsx
import { useThrottledValue } from "@himanshu-sorathiya/react-kit/performance";

interface Coordinates {
	x: number;
	y: number;
}

function CursorTracker({ position }: { position: Coordinates }) {
	const [throttledPosition] = useThrottledValue(position, 100, {
		equalityFn: (previous, next) =>
			previous.x === next.x && previous.y === next.y,
	});

	// Without `equalityFn`, a new `{ x, y }` object on every render would
	// always be treated as "changed" even if the coordinates themselves
	// didn't move, causing an unnecessary re-render on every throttled tick.

	return (
		<div>
			Cursor at ({throttledPosition.x}, {throttledPosition.y})
		</div>
	);
}
```

### Example 3: `useThrottledCallback` — Window Resize Handler

```tsx
import { useEffect } from "react";
import { useThrottledCallback } from "@himanshu-sorathiya/react-kit/performance";

function WindowSizeLogger() {
	const { throttledFunc: handleResize } = useThrottledCallback(
		() => console.log("width:", window.innerWidth),
		200,
	);

	useEffect(() => {
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [handleResize]);

	return null;
}

export { WindowSizeLogger };
```

### Example 4: `useThrottledValue` — Slider Driving a Heavy Component

```tsx
import { useState } from "react";
import { useThrottledValue } from "@himanshu-sorathiya/react-kit/performance";

function HeavyPreview({ value }: { value: number }) {
	// Stand-in for an expensive render (chart, canvas, map, etc.)
	return <p>Rendering preview for: {value}</p>;
}

function SliderDemo() {
	const [raw, setRaw] = useState(0);
	const [throttled] = useThrottledValue(raw, 100);

	return (
		<div>
			<input
				type="range"
				min={0}
				max={100}
				value={raw}
				onChange={(e) => setRaw(Number(e.target.value))}
			/>
			<HeavyPreview value={throttled} />
		</div>
	);
}

export { SliderDemo };
```

### Example 5: `useThrottledState` — Lazy Init, `flush`, and `forceSetValue`

```tsx
import { useThrottledState } from "@himanshu-sorathiya/react-kit/performance";

function expensiveComputation() {
	console.log("computing initial score...");
	return 0;
}

function ScoreBoard() {
	const [score, setScore, { flush, forceSetValue, isPending }] =
		useThrottledState(() => expensiveComputation(), 500);

	return (
		<div>
			<p>Score: {score}</p>
			<button onClick={() => setScore((s) => s + 1)}>+1 (throttled)</button>
			<button onClick={flush}>Flush pending update</button>
			<button onClick={() => forceSetValue(0)}>Reset instantly</button>
			{isPending && <span>update queued...</span>}
		</div>
	);
}

export { ScoreBoard };
```

The setter accepts a functional updater (`(s) => s + 1`) — three rapid clicks before the throttle window settles correctly schedule a cumulative `+3`, rather than three updates racing to be "the" committed value.

## Real-World Use Cases

- Tracking live mouse coordinates for cursor-following UI without flooding React with updates
- Bounding-box / collision checks during drag-and-drop interactions
- Recalculating layout on window resize without triggering a reflow storm
- Recomputing scroll-based effects (parallax, sticky headers, progress bars) on scroll
- Syncing UI state to a smooth, animation-frame-like cadence
- Rate-limiting outbound API polling requests
- Batching high-frequency analytics or telemetry events before sending
- Throttling canvas or WebGL redraws driven by fast-changing input
- Broadcasting cursor or presence position in real-time collaborative tools
- Detecting "near bottom of list" for infinite-scroll pagination triggers

## Gotchas & Edge Cases

### `{ leading: false, trailing: false }` Means "Never"

If you configure both edges off, the throttled function will never run — there's no fallback or auto-correction for this. The suite respects your exact configuration rather than guessing at what you probably meant. A dev-mode warning is logged the moment this configuration is detected (see [Development Warnings](#development-warnings)), so the mistake — if it is one — surfaces immediately instead of manifesting as "my throttle silently does nothing" days later.

If you want the function to still fire under *some* condition, set at least one of `leading` or `trailing` to `true`.

### `useThrottledValue`'s Return Shape

`useThrottledValue` returns a tuple: `[throttledValue, { isPending, cancel, flush }]` — the same utility controls as `useThrottler` and `useThrottledCallback`, scoped to the pending sync of the latest `value`. Reach for `useThrottledState` instead when you need to *own* the state yourself (i.e., you want a setter, not just a mirror of an externally-changing value) — `useThrottledValue` always tracks whatever `value` you pass in; it has no independent setter of its own.

### Automatic Lifecycle Cleanup

Every timer created by `useThrottler` is torn down automatically inside a `useEffect` cleanup function when the owning component unmounts. You do not need to manually call `cancel()` on unmount — dangling timeouts and background memory leaks are handled for you by default.

### Development Warnings

In non-production builds (`process.env.NODE_ENV !== "production"`), this suite logs `console.warn` diagnostics for common misconfigurations, all prefixed with the hook name that raised them. None of these change runtime behavior — they only surface information — and none of them log in production builds.

| Hook | Condition | What's logged |
|---|---|---|
| `useThrottler` | `delay` is not a finite, non-negative number | Warns and reports the clamped fallback value used instead. |
| `useThrottler` | `leading: false` and `trailing: false` together | Warns that the throttled function will never run. |
| `useThrottledCallback` | `func` is not a function | Warns with the actual received type. |
| `useThrottledState` / `useThrottledValue` | `equalityFn` is provided but isn't a function | Warns and falls back to `Object.is`. |

## See Also

- [`useDebouncer`](../useDebouncer/README.md) — the debounce-based counterpart to this suite, for cases where you want to wait for a pause in activity rather than rate-limit activity as it happens.
- [`useRateLimiter`](../useRateLimiter/README.md) — a stricter accept-or-reject alternative when you need a hard cap on how many times something can run per window, rather than reshaping *when* it runs.
- [`useBatcher`](../useBatcher/README.md) — groups every call into a batch instead of discarding intermediate ones, for when you need all the accumulated data, not just the most recent per window.
