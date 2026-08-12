# Rate Limit Hook Suite

A fully type-safe, purely synchronous rate-limiting ecosystem for React, built around a single **master execution engine** (`useRateLimiter`) and three specialized **reactive wrappers** (`useRateLimitedCallback`, `useRateLimitedState`, `useRateLimitedValue`) that adapt it to callbacks, state, and values. Together they give you drop-in protection against spam clicks, chat flooding, API abuse, and any other action that needs a hard ceiling on frequency.

Unlike this repo's debounce and throttle suites, rate limiting never delays or reshapes *when* something runs. Every call is resolved immediately: either an execution is available and it happens right now, or it isn't and the call is rejected outright. There is no queueing, no "eventually consistent" trailing edge — a rejected call is simply gone.

## Motivation (Why this suite?)

Most rate-limiting solutions in the React ecosystem either live entirely on the server (too late — the damage to your UI/UX and your backend load is already done) or are bolted onto components as ad-hoc `setTimeout` logic that quietly breaks the moment a dependency array changes. This suite takes a different approach: **one master hook, two well-defined refill strategies, zero external dependencies.**

Everything in this ecosystem is built around `useRateLimiter`. It doesn't matter whether you're gating a "Submit Payment" button, throttling a chat composer, or protecting a search-as-you-type endpoint — you're always talking to the same underlying engine, just configured differently via `limit`, `windowMs`, and `refillStrategy`. That consistency means you learn the mental model once and reuse it everywhere.

`useRateLimitedCallback` builds directly on top of `useRateLimiter` and solves a very specific, very common pain point: **stale closures**. Instead of re-creating the rate limiter (and its internal timers) every time the wrapped function changes identity, it stores the latest function in a mutable ref. This means:

- You can pass a brand-new inline function on every render without penalty.
- The internal allowance bookkeeping is never torn down and re-initialized due to a changing `func` reference.
- There is no dependency thrashing — `run`'s identity stays stable across renders driven by parent state changes.

`useRateLimitedState` and `useRateLimitedValue` build on `useRateLimitedCallback` in turn, extending the same accept-or-reject model to a locally-owned piece of state and an externally-changing value, respectively.

## Import Syntax

```tsx
// Preferred
import {
	useRateLimiter,
	useRateLimitedCallback,
	useRateLimitedState,
	useRateLimitedValue,
	type UseRateLimiterReturn,
	type UseRateLimitedCallbackReturn,
	type UseRateLimitedStateReturn,
	type UseRateLimitedValueReturn,
	type RateLimitOptions,
	type UseRateLimitedStateOptions,
	type UseRateLimitedValueOptions,
} from "@himanshu-sorathiya/react-kit/performance";
// Or
import {
	useRateLimiter,
	useRateLimitedCallback,
	useRateLimitedState,
	useRateLimitedValue,
	type UseRateLimiterReturn,
	type UseRateLimitedCallbackReturn,
	type UseRateLimitedStateReturn,
	type UseRateLimitedValueReturn,
	type RateLimitOptions,
	type UseRateLimitedStateOptions,
	type UseRateLimitedValueOptions,
} from "@himanshu-sorathiya/react-kit";
```

## Master Hook Deep Dive (`useRateLimiter`)

`useRateLimiter` is the engine that powers the entire suite. Internally it's implemented as a token bucket — but that's purely an implementation detail; nothing in the public API talks about "tokens." What you interact with is an **allowance**: how many executions are available right now (`remaining`), whether that allowance is exhausted (`isRateLimited`), and a background process that keeps both of those numbers accurate in real time, without you needing to manage any of that bookkeeping yourself.

### Dual Refill Strategies

The hook supports two mutually exclusive refill strategies, set via `options.refillStrategy`:

- **`"burst"` (fixed window)** — the default. All executions are consumed from a single pool. Once the pool hits zero, **no further executions are available until the entire `windowMs` duration has fully elapsed**, at which point the full `limit` is restored all at once. This produces classic "burst, then lockout" behavior — ideal for hard caps like login attempts or payment submissions.
- **`"gradual"` (trickle refill)** — instead of waiting for the whole window to expire, the hook continuously and proportionately returns executions as real time passes. This produces a smooth refill that feels far more natural for continuous, repeated actions like sending chat messages or triggering search queries.

Both strategies keep `remaining` accurate on their own, even while your component is otherwise idle — see [Real-Time Allowance Tracking](#real-time-allowance-tracking-while-idle) below.

### Dynamic Execution Slot

Rather than binding to one fixed function at hook-initialization time, `run()` accepts the function **dynamically, on every call**:

```ts
run: <Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => boolean;
```

This means a single `useRateLimiter` instance can act as one shared allowance through which you funnel *different* functions over time — the allowance is decoupled entirely from what it's actually gating.

### Resetting the Allowance

`reset()` immediately restores the full allowance and clears any in-progress refill, independent of how much time has actually elapsed. This is for events that should grant a fresh start outright rather than waiting out the normal window — a successful CAPTCHA, a completed 2FA check, a plan upgrade. See [Example 2](#example-2-master-hook-with-gradual-strategy) for a related pattern using `onRateLimitReached`, and the OTP use case in [Real-World Use Cases](#real-world-use-cases) for `reset()` specifically.

## API Reference

### `useRateLimiter(limit, windowMs, options?)`

**Parameters**

| Parameter  | Type               | Required | Description                                                                                                                                    |
| ---------- | ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `limit`    | `number`           | Yes      | Maximum executions available within a single `windowMs` window. Coerced to a non-negative integer with a floor of `1`; invalid input falls back to `1` with a dev-mode warning. |
| `windowMs` | `number`           | Yes      | Duration of the rate-limiting window, in milliseconds. Coerced to a non-negative number; invalid input falls back to `0`. A value of `0` disables rate limiting entirely (every call allowed), also dev-warned since it's rarely intentional. |
| `options`  | `RateLimitOptions` | No       | Optional configuration object — see below.                                                                                                    |

**`RateLimitOptions`**

| Option               | Type                   | Default   | Description                                                                                                     |
| --------------------- | ---------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| `refillStrategy`      | `"burst" \| "gradual"` | `"burst"` | Determines whether the allowance resets all-at-once (`"burst"`) or replenishes proportionately over time (`"gradual"`). An unrecognized value falls back to `"burst"` with a dev-mode warning. |
| `onRateLimitReached`  | `() => void`           | `undefined` | Called whenever a call is rejected because the allowance is exhausted. Safe to pass as an inline arrow function — see [Inline Callback Safety](#inline-callback-safety). |

**Return Value (`UseRateLimiterReturn`)**

| Property        | Type                                                                        | Description                                                                                          |
| ---------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `run`            | `<Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => boolean` | Invokes `func` immediately if an execution is available (consuming one); otherwise calls `onRateLimitReached` and does nothing else. Returns `true` if `func` ran, `false` if the call was rejected. |
| `reset`          | `() => void`                                                                 | Immediately restores the full allowance, bypassing normal window timing. See [Resetting the Allowance](#resetting-the-allowance). |
| `remaining`      | `number`                                                                     | The current number of available executions, kept in sync with the internal engine and its background timer. |
| `isRateLimited`  | `boolean`                                                                    | Convenience flag, equivalent to `remaining === 0`.                                                       |

### Equality Comparator (`equalityFn`)

`useRateLimitedState` and `useRateLimitedValue` each accept one option beyond `RateLimitOptions`: `equalityFn?: (previous: T, next: T) => boolean`. When a value is about to be committed, `equalityFn` is called against the currently-held value and the incoming one; if it returns `true`, the commit is skipped — no state update, no re-render, and (for `useRateLimitedState`) no allowance consumed for a no-op update. Defaults to `Object.is`.

### `useRateLimitedCallback(func, limit, windowMs, options?)`

**Parameters**

| Parameter  | Type                       | Required | Description                                                                                          |
| ---------- | -------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `func`     | `(...args: Args) => void`  | Yes      | The function you want protected. Always invoked via an internal ref, so passing a new reference on every render is safe. |
| `limit`    | `number`                   | Yes      | See `useRateLimiter`.                                                                                 |
| `windowMs` | `number`                   | Yes      | See `useRateLimiter`.                                                                                 |
| `options`  | `RateLimitOptions`         | No       | Same shape as `useRateLimiter`'s options.                                                             |

**Return Value (`UseRateLimitedCallbackReturn<Args>`)**

| Property           | Type                            | Description                                                                    |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| `rateLimitedFunc`   | `(...args: Args) => boolean`     | A stable, pre-bound version of `func` that enforces the rate limit on every call. Returns `true` if it ran, `false` if rejected. |
| `reset`             | `() => void`                     | Directly proxied from the underlying `useRateLimiter` instance.                |
| `remaining`         | `number`                         | Directly proxied from the underlying `useRateLimiter` instance.                |
| `isRateLimited`     | `boolean`                        | Directly proxied from the underlying `useRateLimiter` instance.                |

### `useRateLimitedState(initialValue, limit, windowMs, options?)`

**Parameters**

| Parameter      | Type                                        | Required | Description                                                              |
| -------------- | -------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `initialValue` | `T \| (() => T)`                              | Yes      | Initial state, or a lazy initializer function (evaluated once, like `useState`). |
| `limit`        | `number`                                     | Yes      | See `useRateLimiter`.                                                    |
| `windowMs`     | `number`                                     | Yes      | See `useRateLimiter`.                                                    |
| `options`      | `UseRateLimitedStateOptions<T>`              | No       | `RateLimitOptions` plus an optional `equalityFn` (see [above](#equality-comparator-equalityfn)). |

**Returns:** a 3-item tuple, `[state, setRateLimitedState, utils]`

| Index                          | Type                                          | Description                                                                    |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `[0]` — state                   | `T`                                             | The current, committed state value.                                          |
| `[1]` — setRateLimitedState     | `(value: T \| ((previous: T) => T)) => boolean` | Attempts a state update; accepts a plain value or functional updater. Returns `true` if applied, `false` if rejected. |
| `[2]` — `utils.remaining`       | `number`                                        | Executions remaining in the current window.                                  |
| `[2]` — `utils.isRateLimited`   | `boolean`                                       | `true` when the allowance is exhausted.                                      |
| `[2]` — `utils.reset`           | `() => void`                                    | Immediately restores the full allowance.                                     |
| `[2]` — `utils.forceSetValue`   | `(value: T \| ((previous: T) => T)) => void`    | Bypasses the limiter entirely and applies immediately, without consuming any allowance. |

### `useRateLimitedValue(value, limit, windowMs, options?)`

**Parameters**

| Parameter  | Type                            | Required | Description                                                              |
| ---------- | -------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `value`    | `T`                               | Yes      | The externally-changing source value to rate-limit.                     |
| `limit`    | `number`                         | Yes      | See `useRateLimiter`.                                                    |
| `windowMs` | `number`                         | Yes      | See `useRateLimiter`.                                                    |
| `options`  | `UseRateLimitedValueOptions<T>`  | No       | `RateLimitOptions` plus an optional `equalityFn` (see [above](#equality-comparator-equalityfn)). |

**Returns:** a 2-item tuple, `[rateLimitedValue, utils]`

| Index                          | Type      | Description                                          |
| -------------------------------- | ----------- | ------------------------------------------------------- |
| `[0]` — rateLimitedValue        | `T`         | The rate-limited mirror of `value`. See [`useRateLimitedValue`'s Weaker Guarantee](#userate limitedvalues-weaker-guarantee) below before reaching for this one. |
| `[1]` — `utils.remaining`       | `number`    | Executions remaining in the current window.          |
| `[1]` — `utils.isRateLimited`   | `boolean`   | `true` when the allowance is exhausted.               |
| `[1]` — `utils.reset`           | `() => void`| Immediately restores the full allowance.              |

## Ecosystem Examples

### Example 1: Master Hook with `'burst'` Strategy

A strict submit button that permits exactly 3 clicks every 10 seconds, then fully locks out until the window resets.

```tsx
import { useRateLimiter } from "@himanshu-sorathiya/react-kit/performance";

function SubmitButton() {
	const { run, remaining, isRateLimited } = useRateLimiter(3, 10_000, {
		refillStrategy: "burst",
		onRateLimitReached: () => alert("Too many attempts. Please wait a moment."),
	});

	const handleSubmit = () => {
		console.log("Form submitted!");
	};

	return (
		<button onClick={() => run(handleSubmit)} disabled={isRateLimited}>
			Submit ({remaining} left)
		</button>
	);
}

export { SubmitButton };
```

### Example 2: Master Hook with `'gradual'` Strategy

A chat composer where the allowance refills smoothly and continuously, rather than in one lump reset.

```tsx
import { useRateLimiter } from "@himanshu-sorathiya/react-kit/performance";

function ChatComposer() {
	const { run, remaining, isRateLimited } = useRateLimiter(5, 5_000, {
		refillStrategy: "gradual",
	});

	const sendMessage = (text: string) => {
		console.log("Sending message:", text);
	};

	return (
		<button
			onClick={() => run(sendMessage, "Hello there!")}
			disabled={isRateLimited}
		>
			Send ({remaining} available)
		</button>
	);
}

export { ChatComposer };
```

### Example 3: `useRateLimitedCallback` — Protecting an API Call

```tsx
import { useRateLimitedCallback } from "@himanshu-sorathiya/react-kit/performance";

function SearchBox() {
	const fetchResults = (query: string) => {
		fetch(`/api/search?q=${query}`);
	};

	const { rateLimitedFunc, isRateLimited } = useRateLimitedCallback(
		fetchResults,
		10,
		60_000,
		{ refillStrategy: "gradual" },
	);

	return (
		<input
			disabled={isRateLimited}
			onChange={(e) => rateLimitedFunc(e.target.value)}
			placeholder="Search..."
		/>
	);
}

export { SearchBox };
```

### Example 4: `useRateLimitedState` — A Capped Local Action

```tsx
import { useRateLimitedState } from "@himanshu-sorathiya/react-kit/performance";

function GenerationDemo() {
	const [result, generate, { remaining, isRateLimited }] =
		useRateLimitedState<string | null>(null, 3, 60_000);

	return (
		<div>
			<button
				onClick={() => generate(`Result #${Math.floor(Math.random() * 1000)}`)}
				disabled={isRateLimited}
			>
				Generate ({remaining} left)
			</button>
			<p>{result}</p>
		</div>
	);
}

export { GenerationDemo };
```

### Example 5: `useRateLimitedValue` — Capping a Notification Feed

```tsx
import { useRateLimitedValue } from "@himanshu-sorathiya/react-kit/performance";

function NotificationFeed({ latestNotification }: { latestNotification: string }) {
	const [visibleNotification] = useRateLimitedValue(latestNotification, 3, 10_000);

	// At most 3 notifications surface per 10s window; any beyond that are
	// silently dropped rather than queued for later display.

	return <p>{visibleNotification}</p>;
}

export { NotificationFeed };
```

### Example 6: Checking Whether a Call Actually Fired

Every setter/runner in this suite returns `boolean` — useful when you want to react to a rejection right at the call site instead of watching `isRateLimited` separately.

```tsx
import { useRateLimitedCallback } from "@himanshu-sorathiya/react-kit/performance";

function VoteButton() {
	const { rateLimitedFunc: castVote } = useRateLimitedCallback(
		() => console.log("Vote recorded"),
		1,
		3_000,
	);

	const handleClick = () => {
		const didVote = castVote();
		if (!didVote) {
			console.log("Please wait before voting again.");
		}
	};

	return <button onClick={handleClick}>Vote</button>;
}

export { VoteButton };
```

## Real-World Use Cases

- Locking a "Submit Payment" button after a fixed number of attempts to prevent duplicate charges — `burst` strategy for a hard lockout.
- Rate-limiting chat message sends to curb flooding in real-time messaging apps — `gradual` strategy for a natural, non-jarring cadence.
- Governing client-side API polling so a dashboard doesn't hammer an endpoint on every re-render or tab refocus.
- Capping "resend code" attempts in an OTP/2FA flow, calling `reset()` after a successful verification to restore the full allowance.
- Enforcing a free-tier usage cap in a client-side demo or sandbox (e.g., "3 free generations before sign-up"), using `useRateLimitedState` to gate a locally-owned result.
- Capping how many toast or notification messages can surface in a short burst, using `useRateLimitedValue` so excess notifications are dropped rather than queued and shown late.
- Enforcing game-mechanic cooldowns, such as limiting how often a player can trigger an ability.
- Capping how often a user can trigger a file upload or export action.
- Enforcing a hard per-minute budget on search-as-you-type network calls — a genuine ceiling independent of typing speed, distinct from throttle's timing-reshaping approach.
- Guarding a CAPTCHA or 2FA verification flow against repeated attempts, resetting via `reset()` once the user succeeds.

## Gotchas & Edge Cases

### Real-Time Allowance Tracking While Idle

`remaining` stays accurate even while your component is completely idle — with no further calls to `run()` at all. The background refill process reschedules itself after every tick until the allowance is fully restored, and it always follows whichever `refillStrategy` you've configured: a full, all-at-once reset for `"burst"` once the window closes, or a proportional trickle for `"gradual"`. You'll never see `remaining` stall partway through recovering just because nothing called `run()` in the meantime — a "3... 2... 1... ready" style countdown UI driven purely by `remaining` will always self-correct on its own.

### `useRateLimitedValue`'s Weaker Guarantee

Unlike `useDebouncedValue` and `useThrottledValue`, `useRateLimitedValue` does **not** guarantee eventual consistency. Those two hooks always deliver the *latest* value once their respective window settles, even if several intermediate values were skipped along the way. `useRateLimitedValue` has no such guarantee — once the allowance is exhausted, further changes to the source `value` are dropped outright, with no queue and no later catch-up. The mirrored value simply stays frozen at whatever it last committed until the allowance refills and a *new* change to `value` arrives.

If you need "the display always eventually reflects the latest value, just not more than once every N ms," reach for `useThrottledValue` instead — that's precisely the guarantee it's built for. Reach for `useRateLimitedValue` specifically when dropping excess updates is the desired behavior (e.g., capping a notification feed, where a missed notification should stay missed rather than surface late).

### Inline Callback Safety

It's completely safe to pass a fresh inline arrow function to `onRateLimitReached` on every render:

```ts
useRateLimiter(3, 10_000, {
	onRateLimitReached: () => toast("Slow down!"),
});
```

Under the hood, the master hook stores this callback in a `useRef`, validating it's actually a function before storing it, and keeps it updated via `useEffect` rather than including it in `run`'s dependency array. This eliminates stale closures (the latest callback is always the one invoked) while also preventing the hook from re-initializing its internal timers just because you passed a new function reference. If a non-function value is accidentally passed, it's safely ignored (with a dev-mode warning) instead of throwing when `onRateLimitReached` would otherwise be called.

### Automatic Lifecycle Cleanup

All background refill timers are automatically cleared when the owning component unmounts. You don't need to manage any cleanup yourself — the hook registers its own `useEffect` cleanup internally to clear any pending `setTimeout` and prevent state updates on an unmounted component.

### Development Warnings

In non-production builds (`process.env.NODE_ENV !== "production"`), this suite logs `console.warn` diagnostics for common misconfigurations, all prefixed with the hook name that raised them. None of these change runtime behavior — they only surface information — and none of them log in production builds.

| Hook | Condition | What's logged |
|---|---|---|
| `useRateLimiter` | `limit` is not a finite number `>= 1` | Warns and reports the clamped fallback value used instead. |
| `useRateLimiter` | `windowMs` is not a finite, non-negative number | Warns and reports the clamped fallback value used instead. |
| `useRateLimiter` | `windowMs` is `0` | Warns that rate limiting is effectively disabled. |
| `useRateLimiter` | `refillStrategy` is provided but isn't `"burst"` or `"gradual"` | Warns and falls back to `"burst"`. |
| `useRateLimiter` | `onRateLimitReached` is provided but isn't a function | Warns and ignores the value. |
| `useRateLimitedCallback` | `func` is not a function | Warns with the actual received type. |
| `useRateLimitedState` / `useRateLimitedValue` | `equalityFn` is provided but isn't a function | Warns and falls back to `Object.is`. |

## See Also

- [`useDebouncer`](../useDebouncer/README.md) — waits for a pause in activity before firing, rather than enforcing a hard ceiling on frequency.
- [`useThrottler`](../useThrottler/README.md) — reshapes *when* activity fires (a steady cadence), rather than accepting or rejecting each call outright.
- [`useBatcher`](../useBatcher/README.md) — groups every call into a batch instead of discarding intermediate ones, for when you need all the accumulated data, not just the latest value.
