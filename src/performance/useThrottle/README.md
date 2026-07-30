# Throttle Hook Suite

A fully type-safe, strictly client-side throttling ecosystem for React, built around a single **master execution engine** (`useThrottle`) and three specialized **reactive wrappers** (`useThrottledCallback`, `useThrottledValue`, `useThrottledState`) that adapt it to callbacks, values, and state.

Every hook in the suite shares the exact same timing engine underneath, so behavior is 100% consistent no matter which layer of your UI you're throttling — from raw event handlers to derived state.

## Motivation (Why this suite?)

Most throttle implementations bolt rate-limiting logic directly onto whatever they're throttling — a callback gets its own timer, a value gets its own timer, and keeping their edge-case behavior (leading fire, trailing fire, cancellation) consistent across a codebase becomes a maintenance burden. This suite takes a different approach: **there is exactly one throttling engine, `useThrottle`, and everything else is a thin adapter over it.**

`useThrottle` doesn't own a specific function. Instead, it exposes a `run(func, ...args)` execution slot — you decide, on every single call, which function and arguments should occupy that slot. This is what makes it a true **engine** rather than a single-purpose utility: the timing logic is completely decoupled from *what* gets throttled.

`useThrottledCallback` builds on top of that engine by wrapping your function in a `funcRef`. Rather than re-creating the throttle timer whenever your callback's identity changes across renders (a common source of bugs and wasted timers in hand-rolled throttle hooks), the ref is silently updated in a `useEffect` on every render. The `run` slot always calls `funcRef.current`, so:

- **Stale closures are structurally impossible.** The function invoked at the trailing edge is always the most recently rendered version — never a snapshot captured when the timer started.
- **Background timers never thrash.** Because the throttled wrapper (`throttledFunc`) is memoized against `run` alone (not against your raw `func`), passing a new inline function on every parent render does not tear down and restart the underlying timer. The cooldown window keeps counting down uninterrupted.

`useThrottledValue` and `useThrottledState` are, in turn, just `useThrottledCallback` wired into `useState` — proving the same engine scales cleanly from "throttle this function call" all the way up to "throttle this piece of reactive state."

## Import Syntax

```tsx
// Preferred
import {
	useThrottle,
	useThrottledCallback,
	useThrottledValue,
	useThrottledState,
	type UseThrottleReturn,
	type UseThrottledCallbackReturn,
	type UseThrottledValueReturn,
	type UseThrottledStateReturn,
	type ThrottleOptions,
} from "@himanshu-sorathiya/react-kit/performance";
// Or
import {
	useThrottle,
	useThrottledCallback,
	useThrottledValue,
	useThrottledState,
	type UseThrottleReturn,
	type UseThrottledCallbackReturn,
	type UseThrottledValueReturn,
	type UseThrottledStateReturn,
	type ThrottleOptions,
} from "@himanshu-sorathiya/react-kit";
```

## Master Hook Deep Dive (`useThrottle`)

`useThrottle` is the foundation every other hook in this suite is built on. It does not know or care what function you're throttling — it only manages **one thing**: a single delay slot that a function and its arguments can occupy at any given moment.

```ts
function useThrottle(delay: number, options?: ThrottleOptions): UseThrottleReturn;
```

Internally, the hook tracks the active function and its arguments in refs (`activeFuncRef`, `lastArgsRef`), a single pending timer (`timerIdRef`), and the timestamp of the last invocation (`lastInvokeTimeRef`). Every call to `run()` updates that shared slot — it never spins up a second, parallel timer.

### Last-Write-Wins execution swapping

Because `run()` accepts the function to invoke *at call time* rather than binding to one function up front, you can pass **completely different functions** into the same ongoing delay window:

```ts
run(saveDraft, draftId);
// ...50ms later, still inside the cooldown window...
run(saveFinal, draftId); // this is the one that will actually fire
```

If both calls land inside the same throttle window, only one trailing invocation ever fires — and it's always the **most recent** function/argument pair passed to `run()`, regardless of what was passed earlier in that window. Earlier requests aren't queued or batched; they're simply superseded. This "Last-Write-Wins" behavior is what lets a single `useThrottle` instance safely back multiple event types or UI branches without any manual coordination.

### Leading and Trailing Defaults

Both `leading` and `trailing` default to `true`. With the defaults in place:

- The **first** call in a cooldown window fires **immediately** (the leading edge).
- If additional `run()` calls arrive while that cooldown is still active, none of them fire right away — but the **last** one received before the window closes fires automatically once the delay elapses (the trailing edge).

This gives you both instant feedback on the first interaction and a guarantee that the final state is never silently dropped. You can tune this per use case:

- `{ trailing: false }` — strict leading-edge rate-limiting. Only the first call per window ever executes; everything else inside the window is discarded.
- `{ leading: false }` — pure trailing-edge debounced-style throttling. Nothing fires until the window closes, at which point the most recent call executes.
- Leaving both at their `true` defaults — the most common configuration — gives you immediate response *and* eventual consistency.

## API Reference

### `useThrottle` — Options

| Option     | Type      | Default | Description                                                                 |
| ---------- | --------- | ------- | ----------------------------------------------------------------------------- |
| `delay`    | `number`  | —       | Required. Length of the cooldown window, in milliseconds.                    |
| `leading`  | `boolean` | `true`  | Fire immediately on the first call of a new cooldown window.                 |
| `trailing` | `boolean` | `true`  | Fire once more at the end of the window using the most recent function/args. |

> ️ If both `leading` and `trailing` are explicitly set to `false`, the hook falls back to `{ leading: true, trailing: true }`. See [Gotchas](#the-config-fallback-safety-valve) below.

### `useThrottle` — Return Value

| Property    | Type                                                              | Description                                                              |
| ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `run`       | `<Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => void` | Occupies the delay slot with `func` and `args`, subject to throttling.  |
| `cancel`    | `() => void`                                                       | Immediately clears any pending trailing invocation and resets state.    |
| `flush`     | `() => void`                                                       | Immediately invokes the pending trailing call (if one is queued).       |
| `isPending` | `boolean`                                                           | `true` while a trailing invocation is queued and waiting to fire.       |

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
| `options` | `ThrottleOptions` (optional)  | `leading` / `trailing` config, identical semantics to `useThrottle`.    |

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
	options?: ThrottleOptions,
): T;
```

**Parameters**

| Parameter | Type                          | Description                                             |
| --------- | ----------------------------- | ----------------------------------------------------------- |
| `value`   | `T`                            | The fast-changing source value to throttle.              |
| `delay`   | `number`                       | Cooldown window, in milliseconds.                        |
| `options` | `ThrottleOptions` (optional)   | `leading` / `trailing` config.                            |

**Returns:** `T` — the throttled value, and nothing else. See [Isolation gotcha](#usethrottledvalue-isolation) below.

### `useThrottledState`

```ts
function useThrottledState<T>(
	initialValue: T | (() => T),
	delay: number,
	options?: ThrottleOptions,
): UseThrottledStateReturn<T>;
```

**Parameters**

| Parameter      | Type                          | Description                                                                 |
| -------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `initialValue` | `T \| (() => T)`               | Initial state, or a lazy initializer function (evaluated once, like `useState`). |
| `delay`        | `number`                       | Cooldown window, in milliseconds.                                            |
| `options`      | `ThrottleOptions` (optional)   | `leading` / `trailing` config.                                               |

**Returns:** a 3-item tuple, `[state, setThrottledState, utils]`

| Index                    | Type                       | Description                                                    |
| ------------------------- | -------------------------- | ------------------------------------------------------------------ |
| `[0]` — state             | `T`                         | The current (throttled) state value.                          |
| `[1]` — setThrottledState | `(value: T) => void`       | Throttled state setter.                                        |
| `[2]` — `utils.isPending`     | `boolean`                   | `true` while an update is queued.                              |
| `[2]` — `utils.cancel`        | `() => void`                | Cancels a pending update.                                      |
| `[2]` — `utils.flush`         | `() => void`                | Immediately applies a pending update.                          |
| `[2]` — `utils.forceSetValue` | `(value: T) => void`       | Bypasses throttling entirely and sets state immediately.        |

## Ecosystem Examples

### Example 1: Master Hook Dynamic Function Swapping

`useThrottle` doesn't lock you into a single function — different event types can share the same throttle slot, and whichever one lands last before the trailing edge is the one that runs.

```tsx
import { useThrottle } from "@himanshu-sorathiya/react-kit/performance";

function ActivityLogger() {
	const { run, isPending } = useThrottle(1000);

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

Two `useThrottle` instances configured side-by-side to show strict leading-edge rate-limiting versus guaranteed trailing delivery.

```tsx
import { useThrottle } from "@himanshu-sorathiya/react-kit/performance";

function RateLimitDemo() {
	// Strict leading-edge: fires instantly, then ignores every call
	// that arrives before the 2s window closes.
	const strict = useThrottle(2000, { leading: true, trailing: false });

	// Guaranteed trailing: nothing fires until the window closes, at
	// which point the most recent call always executes.
	const guaranteed = useThrottle(2000, { leading: false, trailing: true });

	const handleClick = () => {
		strict.run(() => console.log("strict: fired"));
		guaranteed.run(() => console.log("guaranteed: fired"));
	};

	return <button onClick={handleClick}>Fire both</button>;
}

export { RateLimitDemo };
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
	const throttled = useThrottledValue(raw, 100);

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
			<button onClick={() => setScore(score + 1)}>+1 (throttled)</button>
			<button onClick={flush}>Flush pending update</button>
			<button onClick={() => forceSetValue(0)}>Reset instantly</button>
			{isPending && <span>update queued...</span>}
		</div>
	);
}

export { ScoreBoard };
```

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

### The Config Fallback Safety Valve

If you explicitly configure `{ leading: false, trailing: false }`, the hook does **not** silently swallow every `run()` request. Since neither edge would ever fire, that configuration would make execution requests vanish into a dead end. Instead, `useThrottle` defensively falls back to `{ leading: true, trailing: true }` so calls are never lost to a misconfiguration.

### `useThrottledValue` Isolation

`useThrottledValue` returns **only** the throttled value — the raw `T`, with no utility object attached. There is no `cancel`, `flush`, or `isPending` exposed from this hook. If your component needs granular control over the throttling lifecycle (canceling a pending cycle, forcing an immediate sync, or observing pending status), reach for `useThrottledState` instead, which exposes the full utility surface alongside the value.

### Automatic Lifecycle Cleanup

Every timer created by `useThrottle` is torn down automatically inside a `useEffect` cleanup function when the owning component unmounts. You do not need to manually call `cancel()` on unmount — dangling timeouts and background memory leaks are handled for you by default.

## See Also

- [`useDebounce`](../useDebounce/README.md) — the debounce-based counterpart to this suite, for cases where you want to wait for a pause in activity rather than rate-limit activity as it happens.
- [`useVisibility`](../../ui/useVisibility/README.md) — an intersection-observer-based hook for detecting when an element enters or leaves the viewport, often paired with this suite's scroll- and resize-driven use cases.
