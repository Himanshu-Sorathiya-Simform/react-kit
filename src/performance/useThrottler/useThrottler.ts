import { useCallback, useEffect, useRef, useState } from "react";
import type { ThrottleOptions } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The object returned by `useThrottler`.
 */
interface UseThrottlerReturn {
	/**
	 * Registers `func` (with `args`) as the function this cooldown window
	 * will invoke.
	 *
	 * Each call to `run()` accepts its own function — you are not locked
	 * into throttling a single, fixed callback. If a trailing invocation is
	 * still pending when `run()` is called again, the previously-registered
	 * function and arguments are replaced by the new ones — whichever call
	 * was most recent before the window closes is the one that fires (a
	 * "last write wins" swap, not a queue).
	 *
	 * @example
	 * ```ts
	 * const { run } = useThrottler(200);
	 *
	 * run((x: number, y: number) => logPosition(x, y), clientX, clientY);
	 * ```
	 */
	run: <Args extends unknown[]>(
		func: (...args: Args) => void,
		...args: Args
	) => void;

	/**
	 * Clears any pending trailing invocation and resets the cooldown
	 * window entirely — the next call to `run()` is treated as the start
	 * of a fresh window. Sets `isPending` back to `false`.
	 */
	cancel: () => void;

	/**
	 * If a trailing invocation is currently pending, invokes it
	 * immediately (with its most recently registered arguments) and clears
	 * the timer. If nothing is pending, this is a no-op.
	 */
	flush: () => void;

	/**
	 * `true` whenever a trailing invocation is still scheduled to fire
	 * before the current cooldown window closes. `false` once it's known
	 * nothing further will happen — including right after a leading-edge
	 * invocation with no follow-up call yet, not merely once the whole
	 * window elapses.
	 */
	isPending: boolean;
}

/**
 * The throttle engine underlying every hook in this family.
 *
 * `useThrottler` is a low-level scheduling primitive: a single cooldown
 * window and a single "next function to run" slot. Unlike debounce,
 * additional calls that arrive mid-window do not push the window out
 * further — they just update which function/arguments will fire when the
 * *existing* window closes. This is what keeps a continuous stream of
 * calls (mousemove, scroll, resize) firing at a steady cadence instead of
 * only ever firing once activity stops.
 *
 * Most consumers won't reach for this directly — `useThrottledCallback`,
 * `useThrottledState`, and `useThrottledValue` are thin, purpose-built
 * wrappers around it for the common cases. Use `useThrottler` directly
 * when you need the "swap, don't queue" behavior across genuinely
 * different functions.
 *
 * @example
 * ```tsx
 * function ActivityLogger() {
 *   const { run, isPending } = useThrottler(1000);
 *
 *   return (
 *     <div
 *       onMouseMove={(e) => run(logMouseMove, e.clientX, e.clientY)}
 *       onKeyDown={(e) => run(logKeyPress, e.key)}
 *     >
 *       {isPending ? "Recording…" : "Idle"}
 *     </div>
 *   );
 * }
 * ```
 *
 * @param delay - Length of the cooldown window, in milliseconds. Coerced
 * to a non-negative number; invalid input falls back to `0` with a
 * dev-mode warning.
 * @param options - See {@link ThrottleOptions}.
 * @returns See {@link UseThrottlerReturn}.
 */
function useThrottler(
	delay: number,
	options: ThrottleOptions = {},
): UseThrottlerReturn {
	const safeDelay = Math.max(0, Number(delay) || 0);

	if (
		isDev
		&& (typeof delay !== "number" || !Number.isFinite(delay) || delay < 0)
	) {
		console.warn(
			`[useThrottler] Received an invalid \`delay\` (${String(delay)}) — falling back to ${safeDelay}ms.`,
		);
	}

	const [isPending, setIsPending] = useState(false);

	const leading = options?.leading ?? true;
	const trailing = options?.trailing ?? true;

	if (isDev && !leading && !trailing) {
		console.warn(
			"[useThrottler] Both `leading` and `trailing` are false — the throttled function will never be invoked.",
		);
	}

	// The "execution slot": whichever function/arguments were most recently
	// handed to run() live here until they're either invoked or discarded.
	const activeFuncRef = useRef<((...args: unknown[]) => void) | null>(null);
	const lastArgsRef = useRef<unknown[] | null>(null);

	const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Timestamp of the most recent invocation (leading or trailing). Drives
	// both "has the cooldown window fully elapsed" and, on a trailing fire,
	// where the *next* window's cadence should be measured from.
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

		if (func === null || args === null) return;

		if (timerIdRef.current !== null) {
			clearTimeout(timerIdRef.current);
			timerIdRef.current = null;
		}

		// Preserves cadence continuity: if `leading` is enabled, the next
		// window should be measured from "now" (this flush counts as an
		// invocation); if not, there's no leading edge to anchor against,
		// so the window resets entirely.
		lastInvokeTimeRef.current = leading ? Date.now() : -1;
		lastArgsRef.current = null;
		activeFuncRef.current = null;

		setIsPending(false);

		func(...args);
	}, [leading]);

	// Guarantees no dangling timer survives an unmount.
	useEffect(() => {
		return cancel;
	}, [cancel]);

	const run = useCallback(
		<Args extends unknown[]>(func: (...args: Args) => void, ...args: Args) => {
			// Both edges disabled means nothing can ever fire — skip all
			// bookkeeping entirely rather than schedule a timer whose only
			// job would be to reset state nobody will observe.
			if (!leading && !trailing) return;

			const now = Date.now();

			lastArgsRef.current = args;
			activeFuncRef.current = func as (...args: unknown[]) => void;

			const isNewWindow = lastInvokeTimeRef.current === -1;
			const canInvokeNow =
				isNewWindow ? leading : now - lastInvokeTimeRef.current >= safeDelay;

			if (canInvokeNow) {
				if (timerIdRef.current !== null) {
					clearTimeout(timerIdRef.current);
					timerIdRef.current = null;
				}

				const invokeFunc = activeFuncRef.current;
				const invokeArgs = lastArgsRef.current;

				lastInvokeTimeRef.current = now;
				lastArgsRef.current = null;

				setIsPending(false);

				invokeFunc(...invokeArgs);

				return;
			}

			// A cooldown window is already running — only arm a new timer
			// if one isn't already in flight. This is throttle's defining
			// difference from debounce: subsequent calls mid-window update
			// *what* will fire, but never push *when* it fires further out.
			if (timerIdRef.current === null) {
				const elapsed =
					lastInvokeTimeRef.current === -1 ?
						0
					:	now - lastInvokeTimeRef.current;
				const remainingTime = safeDelay - elapsed;

				timerIdRef.current = setTimeout(
					() => {
						timerIdRef.current = null;

						const trailingFunc = activeFuncRef.current;
						const trailingArgs = lastArgsRef.current;

						lastArgsRef.current = null;
						activeFuncRef.current = null;

						setIsPending(false);

						if (
							trailing
							&& trailingFunc !== null
							&& trailingArgs !== null
						) {
							// Anchors the next window's cadence to this
							// trailing fire (if leading is enabled) so a
							// continuous stream of calls keeps a steady
							// rhythm instead of drifting.
							lastInvokeTimeRef.current = leading ? Date.now() : -1;
							trailingFunc(...trailingArgs);
						} else {
							lastInvokeTimeRef.current = -1;
						}
					},
					Math.max(0, remainingTime),
				);
			}

			// Mirrors whether a trailing invocation will actually happen —
			// not merely whether the cooldown window is running. See
			// `UseThrottlerReturn.isPending`.
			setIsPending(trailing);
		},
		[safeDelay, leading, trailing],
	);

	return { run, cancel, flush, isPending };
}

export { type UseThrottlerReturn, useThrottler };
