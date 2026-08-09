import { useEffect, useState } from "react";
import type { UseThrottledValueOptions } from "./types.ts";
import { useThrottledCallback } from "./useThrottledCallback.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The tuple returned by `useThrottledValue`.
 */
type UseThrottledValueReturn<T> = [
	/** The throttled (rate-limited) mirror of the source value. */
	T,
	{
		/** See {@link UseThrottlerReturn.isPending}. */
		isPending: boolean;
		/** Cancels the pending sync to the latest source value. */
		cancel: () => void;
		/** Immediately commits the latest source value, bypassing the wait. */
		flush: () => void;
	},
];

/**
 * Mirrors `value`, but the mirror updates at most once every `delay`
 * milliseconds — a safe, rate-limited dependency for an expensive
 * downstream render (chart, canvas, map) driven by a fast-changing source
 * like a slider or live coordinates.
 *
 * @remarks
 * With the default `{ leading: true }`, the mirror updates almost
 * immediately on the first change — throttle is about limiting *rate*,
 * not deferring the first response the way debounce does.
 *
 * @example
 * ```tsx
 * function SliderDemo() {
 *   const [raw, setRaw] = useState(0);
 *   const [throttled] = useThrottledValue(raw, 100);
 *
 *   return (
 *     <>
 *       <input
 *         type="range"
 *         value={raw}
 *         onChange={(e) => setRaw(Number(e.target.value))}
 *       />
 *       <HeavyPreview value={throttled} />
 *     </>
 *   );
 * }
 * ```
 *
 * @param value - The source value to throttle. Every change is subject to
 * the cooldown window.
 * @param delay - See {@link useThrottler}.
 * @param options - See {@link UseThrottledValueOptions}.
 * @returns See {@link UseThrottledValueReturn}.
 */
function useThrottledValue<T>(
	value: T,
	delay: number,
	options: UseThrottledValueOptions<T> = {},
): UseThrottledValueReturn<T> {
	if (
		isDev
		&& options.equalityFn !== undefined
		&& typeof options.equalityFn !== "function"
	) {
		console.warn(
			"[useThrottledValue] `equalityFn` must be a function — falling back to `Object.is`.",
		);
	}

	const equalityFn =
		typeof options.equalityFn === "function" ? options.equalityFn : Object.is;

	const [throttledValue, setThrottledValue] = useState<T>(value);

	const { throttledFunc, cancel, flush, isPending } = useThrottledCallback(
		(newValue: T) => {
			setThrottledValue((previous) =>
				equalityFn(previous, newValue) ? previous : newValue,
			);
		},
		delay,
		options,
	);

	// Re-arms the throttle cycle every time `value` changes.
	useEffect(() => {
		throttledFunc(value);
	}, [value, throttledFunc]);

	return [throttledValue, { isPending, cancel, flush }] as const;
}

export { type UseThrottledValueReturn, useThrottledValue };
