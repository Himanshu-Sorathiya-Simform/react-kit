import { useEffect, useState } from "react";
import type { UseDebouncedValueOptions } from "./types.ts";
import { useDebouncedCallback } from "./useDebouncedCallback.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The tuple returned by `useDebouncedValue`.
 */
type UseDebouncedValueReturn<T> = [
	/** The debounced (lagging) mirror of the source value. */
	T,
	{
		/** See {@link UseDebouncerReturn.isPending}. */
		isPending: boolean;
		/** Cancels the pending sync to the latest source value. */
		cancel: () => void;
		/** Immediately commits the latest source value, bypassing the delay. */
		flush: () => void;
	},
];

/**
 * Mirrors `value`, but the mirror only updates `delay` milliseconds after
 * `value` stops changing — a safe, stable dependency for an expensive
 * effect (filtering, fetching) that shouldn't re-run on every keystroke.
 *
 * @example
 * ```tsx
 * function ProductFilterField() {
 *   const [query, setQuery] = useState("");
 *   const [debouncedQuery] = useDebouncedValue(query, 350);
 *
 *   // `debouncedQuery` only updates 350ms after typing stops.
 *
 *   return (
 *     <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *   );
 * }
 * ```
 *
 * @param value - The source value to debounce. Every change re-arms the
 * debounce window.
 * @param delay - See {@link useDebouncer}.
 * @param options - See {@link UseDebouncedValueOptions}.
 * @returns See {@link UseDebouncedValueReturn}.
 */
function useDebouncedValue<T>(
	value: T,
	delay: number,
	options: UseDebouncedValueOptions<T> = {},
): UseDebouncedValueReturn<T> {
	if (
		isDev
		&& options.equalityFn !== undefined
		&& typeof options.equalityFn !== "function"
	) {
		console.warn(
			"[useDebouncedValue] `equalityFn` must be a function — falling back to `Object.is`.",
		);
	}

	const equalityFn =
		typeof options.equalityFn === "function" ? options.equalityFn : Object.is;

	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	const { debouncedFunc, cancel, flush, isPending } = useDebouncedCallback(
		(newValue: T) => {
			setDebouncedValue((previous) =>
				equalityFn(previous, newValue) ? previous : newValue,
			);
		},
		delay,
		options,
	);

	// Re-arms the debounce window every time `value` changes.
	useEffect(() => {
		debouncedFunc(value);
	}, [value, debouncedFunc]);

	return [debouncedValue, { isPending, cancel, flush }] as const;
}

export { type UseDebouncedValueReturn, useDebouncedValue };
