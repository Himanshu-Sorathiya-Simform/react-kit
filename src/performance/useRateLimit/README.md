# Rate Limit Hook Suite

A fully type-safe, strictly client-side rate-limiting ecosystem for React, built around a single **master execution engine** (`useRateLimit`) and a specialized **reactive wrapper** (`useRateLimitedCallback`) that adapts it to callbacks. Together they give you drop-in protection against spam clicks, chat flooding, API abuse, and any other action that needs a hard or soft ceiling on frequency.

## Motivation (Why this suite?)

Most rate-limiting solutions in the React ecosystem either live entirely on the server (too late — the damage to your UI/UX and your backend load is already done) or are bolted onto components as ad-hoc `setTimeout` logic that quietly breaks the moment a dependency array changes. This suite takes a different approach: **one master hook, two well-defined refill strategies, zero external dependencies.**

Everything in this ecosystem is built around `useRateLimit`. It doesn't matter whether you're gating a "Submit Payment" button, throttling a chat composer, or protecting a search-as-you-type endpoint — you're always talking to the same underlying token engine, just configured differently via `limit`, `windowMs`, and `refillStrategy`. That consistency means you learn the mental model once (Token Bucket vs. Fixed Window) and reuse it everywhere.

`useRateLimitedCallback` builds directly on top of `useRateLimit` and solves a very specific, very common pain point: **stale closures**. Instead of re-creating the rate limiter (and its internal timers) every time the wrapped function changes identity, it stores the latest function in a mutable `funcRef`. This means:

- You can pass a brand-new inline function on every render without penalty.
- The internal timer/token bookkeeping is never torn down and re-initialized due to a changing `func` reference.
- There is no dependency thrashing — `run`'s identity stays stable across renders driven by parent state changes.

The result is a rate-limiting layer that behaves exactly like you'd expect, with none of the usual "why did my timer reset" surprises.

## Import Syntax

```tsx
// Preferred
import {
	useRateLimit,
	useRateLimitedCallback,
	type UseRateLimitReturn,
	type UseRateLimitedCallbackReturn,
	type RateLimitOptions,
} from "@himanshu-sorathiya/react-kit/performance";
// Or
import {
	useRateLimit,
	useRateLimitedCallback,
	type UseRateLimitReturn,
	type UseRateLimitedCallbackReturn,
	type RateLimitOptions,
} from "@himanshu-sorathiya/react-kit";
```

## Master Hook Deep Dive (`useRateLimit`)

`useRateLimit` is the engine that powers the entire suite. It maintains an internal token count (`tokensRef`), a last-refill timestamp, and a single background timer that keeps the visible `remaining` count in sync with reality — all without forcing consumers to manage any of that bookkeeping themselves.

### Dual Refill Strategies

The hook supports two mutually exclusive refill strategies, set via `options.refillStrategy`:

- **`"burst"` (Fixed Window)** — This is the default strategy. All tokens are consumed as a single pool. Once the pool hits zero, **no further tokens are available until the entire `windowMs` duration has fully elapsed**, at which point the full `limit` is restored all at once. This produces classic "burst, then lockout" behavior — ideal for hard caps like login attempts or payment submissions.
- **`"gradual"` (Token Bucket)** — Instead of waiting for the whole window to expire, the hook mathematically calculates a `timePerToken` value (`windowMs / limit`) and continuously — and proportionately — replenishes tokens as real time passes. This produces a smooth, trickle-style refill that feels far more natural for continuous, repeated actions like sending chat messages or triggering search queries.

### Dynamic Execution Slot

Rather than binding to one fixed function at hook-initialization time, `run()` accepts the function **dynamically, on every call**:

```ts
run: <Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => void;
```

This means a single `useRateLimit` instance can act as one shared "rate-limited slot" through which you funnel *different* functions over time — the token economy is decoupled entirely from what it's actually gating.

## API Reference

### `useRateLimit(limit, windowMs, options?)`

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `limit` | `number` | Yes | Maximum number of tokens (allowed executions) available within a single `windowMs` window. |
| `windowMs` | `number` | Yes | Duration of the rate-limiting window, in milliseconds. |
| `options` | `RateLimitOptions` | No | Optional configuration object — see below. |

**`RateLimitOptions`**

| Option | Type | Default | Description |
|---|---|---|---|
| `refillStrategy` | `"burst" \| "gradual"` | `"burst"` | Determines whether tokens reset all-at-once (`"burst"`) or replenish proportionately over time (`"gradual"`). |
| `onRateLimitReached` | `() => void` | `undefined` | Fired whenever `run()` is called with zero tokens remaining. Safe to pass as an inline arrow function — see [Gotchas](#gotchas--edge-cases). |

**Return Value (`UseRateLimitReturn`)**

| Property | Type | Description |
|---|---|---|
| `run` | `<Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => void` | Executes `func` immediately if a token is available (consuming one token); otherwise invokes `onRateLimitReached`. |
| `remaining` | `number` | The current number of available tokens, kept in sync with the internal engine and background timer. |
| `isRateLimited` | `boolean` | Convenience flag, equivalent to `remaining === 0`. |

---

### `useRateLimitedCallback(func, limit, windowMs, options?)`

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `func` | `(...args: Args) => void` | Yes | The function you want protected. Always invoked via an internal `funcRef`, so passing a new reference on every render is safe. |
| `limit` | `number` | Yes | Maximum number of tokens available within a single `windowMs` window. |
| `windowMs` | `number` | Yes | Duration of the rate-limiting window, in milliseconds. |
| `options` | `RateLimitOptions` | No | Same shape as `useRateLimit`'s options — `refillStrategy` and `onRateLimitReached`. |

**Return Value (`UseRateLimitedCallbackReturn<Args>`)**

| Property | Type | Description |
|---|---|---|
| `rateLimitedFunc` | `(...args: Args) => void` | A stable, pre-bound version of `func` that automatically enforces the rate limit whenever it's called. |
| `remaining` | `number` | Directly proxied from the underlying `useRateLimit` instance. |
| `isRateLimited` | `boolean` | Directly proxied from the underlying `useRateLimit` instance. |

## Ecosystem Examples

### Example 1: Master Hook with `'burst'` Strategy

A strict submit button that permits exactly 3 clicks every 10 seconds, then fully locks out until the window resets.

```tsx
import { useRateLimit } from "@himanshu-sorathiya/react-kit";

function SubmitButton() {
	const { run, remaining, isRateLimited } = useRateLimit(3, 10_000, {
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

A chat composer where tokens refill smoothly and continuously, rather than in one lump reset.

```tsx
import { useRateLimit } from "@himanshu-sorathiya/react-kit";

function ChatComposer() {
	const { run, remaining, isRateLimited } = useRateLimit(5, 5_000, {
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
			Send ({remaining} tokens available)
		</button>
	);
}

export { ChatComposer };
```

### Example 3: `useRateLimitedCallback` Implementation

Wrapping an API fetch call so the endpoint is automatically protected from being spammed.

```tsx
import { useRateLimitedCallback } from "@himanshu-sorathiya/react-kit";

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

## Real-World Use Cases

- Locking a "Submit Payment" button after a set number of attempts to prevent duplicate charges.
- Rate-limiting chat message sends to curb flooding in real-time messaging apps.
- Governing API polling requests so a dashboard doesn't hammer an endpoint on every re-render.
- Throttling expensive client-side computation triggers (e.g., recalculating a large dataset on every keystroke).
- Enforcing game mechanic cooldowns, such as limiting how often a player can fire an ability.
- Protecting search-as-you-type inputs from firing a network request on every character.
- Capping how often a user can trigger a file upload or export action.
- Preventing double-submission of forms caused by accidental double-clicks.

## Gotchas & Edge Cases

### Lazy UI State Updates (Performance Optimization)

When the hook is completely idle, the background refill timer is intentionally lazy: it only bumps the `remaining` state by `+1` and then stops, rather than scheduling a cascade of updates to fully "catch up" the token count in the background. This is a deliberate optimization to avoid useless render cycles while nobody is interacting with the component. The moment the user calls `run()` again, the internal math instantly recalculates and accounts for all tokens that should have accrued in the meantime — so the visible `remaining` value is always accurate at the point it actually matters, without wasting renders while idle.

### Inline Callback Safety

It's completely safe to pass a fresh inline arrow function to `onRateLimitReached` on every render:

```ts
useRateLimit(3, 10_000, {
	onRateLimitReached: () => toast("Slow down!"),
});
```

Under the hood, the master hook stores this callback in a mutable `useRef` and keeps it updated via `useEffect`, rather than including it in `run`'s dependency array. This eliminates stale closures (the latest callback is always the one invoked) while also preventing the hook from re-initializing its internal timers just because you passed a new function reference.

### Automatic Lifecycle Cleanup

All background refill timers are automatically cleared when the owning component unmounts. You don't need to manage any cleanup yourself — the hook registers its own `useEffect` cleanup internally to clear any pending `setTimeout` and prevent state updates on an unmounted component.

## See Also

- [useDebounce](../useDebounce/README.md)
- [useThrottle](../useThrottle/README.md)
