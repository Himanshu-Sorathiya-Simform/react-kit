import { useCallback, useEffect, useRef, useState } from "react";
import type { DebounceOptions } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The object returned by `useDebouncer`.
 */
interface UseDebouncerReturn {
	/**
	 * Registers `func` (with `args`) as the function this debounce cycle
	 * will invoke, and (re)arms the debounce timer.
	 *
	 * Each call to `run()` accepts its own function — you are not locked
	 * into debouncing a single, fixed callback. If `run()` is called again
	 * before the pending timer fires, the previously-registered function
	 * and arguments are discarded entirely in favor of the new ones (a
	 * "last write wins" swap, not a queue).
	 *
	 * @example
	 * ```ts
	 * const { run } = useDebouncer(300);
	 *
	 * run((query: string) => fetchResults(query), searchTerm);
	 * ```
	 */
	run: <Args extends unknown[]>(
		func: (...args: Args) => void,
		...args: Args
	) => void;

	/**
	 * Clears the pending timer and discards whatever function/arguments
	 * were registered via `run()`, without invoking anything. Sets
	 * `isPending` back to `false`.
	 */
	cancel: () => void;

	/**
	 * If a function is currently pending invocation, invokes it immediately
	 * (with its most recently registered arguments) and clears the timer.
	 * If nothing is pending, this is a no-op.
	 */
	flush: () => void;

	/**
	 * `true` whenever a trailing invocation is still scheduled to happen
	 * when the current cycle settles. `false` once it's known nothing
	 * further will fire — including immediately after a leading-edge
	 * invocation if `trailing` is disabled, not merely once the full window
	 * elapses.
	 */
	isPending: boolean;
}

/**
 * The debounce engine underlying every hook in this family.
 *
 * `useDebouncer` is a low-level scheduling primitive: a single timer and a
 * single "next function to run" slot. Calling `run(func, ...args)`
 * registers `func` as the occupant of that slot; if `run()` is called
 * again before the timer fires, the new function/arguments replace the old
 * ones outright.
 *
 * Most consumers won't reach for this directly — `useDebouncedCallback`,
 * `useDebouncedState`, and `useDebouncedValue` are thin, purpose-built
 * wrappers around it for the common cases (debouncing one fixed callback,
 * a piece of state, or an incoming value). Use `useDebouncer` directly when
 * you need the "swap, don't queue" behavior across genuinely different
 * functions — see the example below.
 *
 * @example
 * ```tsx
 * function DocumentActionBar() {
 *   const { run, isPending } = useDebouncer(1000);
 *
 *   const handleSave = () => run(() => saveDocument());
 *   const handleCancel = () => run(() => discardChanges());
 *
 *   return (
 *     <>
 *       <button onClick={handleSave}>Save</button>
 *       <button onClick={handleCancel}>Cancel</button>
 *       {isPending && <span>Pending…</span>}
 *     </>
 *   );
 * }
 * ```
 *
 * @param delay - Milliseconds to wait before a trailing invocation fires.
 * Coerced to a non-negative number; invalid input falls back to `0` with a
 * dev-mode warning.
 * @param options - See {@link DebounceOptions}.
 * @returns See {@link UseDebouncerReturn}.
 */
function useDebouncer(
	delay: number,
	options: DebounceOptions = {},
): UseDebouncerReturn {
	const safeDelay = Math.max(0, Number(delay) || 0);

	if (
		isDev
		&& (typeof delay !== "number" || !Number.isFinite(delay) || delay < 0)
	) {
		console.warn(
			`[useDebouncer] Received an invalid \`delay\` (${String(delay)}) — falling back to ${safeDelay}ms.`,
		);
	}

	const [isPending, setIsPending] = useState(false);

	const maxWait = options?.maxWait;
	const leading = !!options?.leading;
	// Always defaults to `true`, independent of `leading` — and this does
	// NOT auto-correct an explicit `{ leading: false, trailing: false }`
	// back to something that fires. That combination is respected as-is
	// (see the dev warning immediately below).
	const trailing = options?.trailing ?? true;

	if (isDev && !leading && !trailing) {
		console.warn(
			"[useDebouncer] Both `leading` and `trailing` are false — the debounced function will never be invoked.",
		);
	}

	if (isDev && maxWait !== undefined && maxWait < safeDelay) {
		console.warn(
			`[useDebouncer] \`maxWait\` (${maxWait}ms) is smaller than \`delay\` (${safeDelay}ms) — the function will fire on almost every call.`,
		);
	}

	// The "execution slot": whichever function/arguments were most recently
	// handed to run() live here until they're either invoked or discarded.
	const activeFuncRef = useRef<((...args: unknown[]) => void) | null>(null);
	const lastArgsRef = useRef<unknown[] | null>(null);

	const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Timestamp marking the start of the current cycle. Reset to `-1`
	// between cycles; drives both the "is this a fresh call" check and the
	// `maxWait` ceiling.
	const lastInvokeTimeRef = useRef(-1);

	const cancel = useCallback(() => {
		if (timerIdRef.current !== null) {
			clearTimeout(timerIdRef.current);

			timerIdRef.current = null;
		}

		lastInvokeTimeRef.current = -1;
		lastArgsRef.current = null;
		activeFuncRef.current = null;

		setIsPending(false);
	}, []);

	const flush = useCallback(() => {
		const func = activeFuncRef.current;
		const args = lastArgsRef.current;

		// Nothing to flush if there's no pending timer, or the slot is
		// empty (e.g. a leading-only invocation already fired and no
		// follow-up call arrived to justify a trailing invoke).
		if (timerIdRef.current === null || func === null || args === null) return;

		clearTimeout(timerIdRef.current);
		timerIdRef.current = null;

		lastInvokeTimeRef.current = -1;
		lastArgsRef.current = null;
		activeFuncRef.current = null;

		setIsPending(false);

		func(...args);
	}, []);

	// Guarantees no dangling timer survives an unmount.
	useEffect(() => {
		return cancel;
	}, [cancel]);

	const run = useCallback(
		<Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => {
			const now = Date.now();

			activeFuncRef.current = func as (...args: unknown[]) => void;
			lastArgsRef.current = args;

			const isNewBurst = lastInvokeTimeRef.current === -1;

			if (isNewBurst) {
				lastInvokeTimeRef.current = now;

				if (leading) {
					const leadingFunc = activeFuncRef.current;
					const leadingArgs = lastArgsRef.current;

					// Clearing `lastArgsRef` right after a leading invoke is
					// what lets the trailing-edge checks below (both the
					// maxWait branch and the scheduled timeout) tell "a
					// single isolated call" apart from "a second call
					// arrived during the window" — deterministically,
					// without comparing timestamps.
					lastArgsRef.current = null;

					leadingFunc(...leadingArgs);
				}
			}

			const pendingFunc = activeFuncRef.current;
			const pendingArgs = lastArgsRef.current;

			if (
				maxWait !== undefined
				&& pendingFunc !== null
				&& pendingArgs !== null
				&& now - lastInvokeTimeRef.current >= maxWait
			) {
				if (timerIdRef.current !== null) {
					clearTimeout(timerIdRef.current);
					timerIdRef.current = null;
				}

				lastInvokeTimeRef.current = -1;
				lastArgsRef.current = null;
				activeFuncRef.current = null;

				setIsPending(false);

				pendingFunc(...pendingArgs);

				return;
			}

			if (timerIdRef.current !== null) {
				clearTimeout(timerIdRef.current);
			}

			timerIdRef.current = setTimeout(() => {
				timerIdRef.current = null;

				const trailingFunc = activeFuncRef.current;
				const trailingArgs = lastArgsRef.current;

				lastInvokeTimeRef.current = -1;
				lastArgsRef.current = null;
				activeFuncRef.current = null;

				setIsPending(false);

				// `trailingArgs` is only non-null here if a call arrived
				// after the leading edge fired (or if leading never fired
				// at all) — see the comment above.
				if (trailing && trailingFunc !== null && trailingArgs !== null) {
					trailingFunc(...trailingArgs);
				}
			}, safeDelay);

			// Mirrors whether a trailing invocation will actually happen —
			// not merely whether the debounce window is open. See
			// `UseDebouncerReturn.isPending`.
			setIsPending(trailing);
		},
		[safeDelay, maxWait, trailing, leading],
	);

	return { run, cancel, flush, isPending };
}

export { type UseDebouncerReturn, useDebouncer };
