import { useCallback, useEffect, useRef, useState } from "react";

import type { ControllableDispatch, UseControllableStateOptions } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * A drop-in `useState` replacement that transparently supports **both
 * controlled and uncontrolled** usage — the same dual-mode contract that
 * native HTML elements (`<input value>` vs `<input defaultValue>`) and every
 * serious React component library expose.
 *
 * ### Modes
 *
 * | `value` prop | Mode | Source of truth |
 * |---|---|---|
 * | `undefined` | **Uncontrolled** | Internal `useState` (seeded by `defaultValue`) |
 * | anything else (including `null`) | **Controlled** | The `value` prop itself |
 *
 * ### Core guarantees
 *
 * 1. **Functional updaters** — the dispatcher accepts `T | ((prev) => T)`,
 *    mirroring `useState`. The `prev` argument is always the freshest known
 *    value: in controlled mode that's the current `value` prop; in
 *    uncontrolled mode it's the current internal state. This stays correct
 *    even across multiple synchronous dispatches in the same tick (e.g. two
 *    calls back-to-back in one event handler), because the "latest value"
 *    ref is updated immediately inside `dispatch` itself rather than waiting
 *    for the next render's effect to catch up.
 * 2. **Stable `onChange`** — the callback is held in a ref and updated
 *    before each dispatch, so callers never need to memoize their handler
 *    with `useCallback`.
 * 3. **Mode-switching guard (dev only)** — switching between controlled and
 *    uncontrolled after mount logs a descriptive error exactly once per
 *    transition, matching React's own `<input>` behavior.
 * 4. **No-op dispatches are inert** — if the resolved next value is
 *    `Object.is`-equal to the current one, the hook writes no internal
 *    state AND does not call `onChange`. "Nothing changed" means nothing
 *    happens, in either mode.
 * 5. **`null` vs `undefined` are not conflated** — only `undefined` means
 *    "not provided." A `defaultValue: null` or an internal state of `null`
 *    is honored as a real value and will never be silently swapped for
 *    `fallbackValue`.
 * 6. **`fallbackValue` overload** — callers that provide a fallback get back
 *    `T` (never `T | undefined`) for both the resolved value AND the `prev`
 *    argument of functional updaters, avoiding null-checks downstream. Omit
 *    it and both become `T | undefined`, and TypeScript will require you to
 *    handle that.
 *
 * @typeParam T - The type of the value being managed.
 * @param options - See {@link UseControllableStateOptions}.
 * @returns A `[value, dispatch]` tuple — identical ergonomics to `useState`.
 *
 * @example Uncontrolled (self-managed state)
 * ```ts
 * const [page, setPage] = useControllableState({ defaultValue: 1 });
 * ```
 *
 * @example Controlled (parent owns the state)
 * ```ts
 * const [page, setPage] = useControllableState({
 *   value: props.page,
 *   onChange: props.onPageChange,
 * });
 * ```
 *
 * @example Dual-mode hook (supports both, fallback guarantees T)
 * ```ts
 * function usePagination({ page, defaultPage, onPageChange }: Props) {
 *   const [currentPage, setPage] = useControllableState({
 *     value: page,
 *     defaultValue: defaultPage,
 *     onChange: onPageChange,
 *     fallbackValue: 1,
 *     hookName: "usePagination",
 *   });
 *   // currentPage is `number`, never `number | undefined`
 *   // setPage(prev => prev + 1) -- `prev` is `number`, no null-check needed
 * }
 * ```
 *
 * @example No fallback (value AND `prev` become optional)
 * ```ts
 * const [item, setItem] = useControllableState<Item>({ defaultValue: undefined });
 * // item: Item | undefined
 * setItem(prev => {
 *   //           ^? Item | undefined -- TypeScript forces you to handle this
 *   return prev ? { ...prev, seen: true } : prev;
 * });
 * ```
 */
function useControllableState<T>(
	options: UseControllableStateOptions<T> & { fallbackValue: T },
): [T, ControllableDispatch<T>];

function useControllableState<T>(
	options: UseControllableStateOptions<T>,
): [T | undefined, ControllableDispatch<T, T | undefined>];

function useControllableState<T>({
	value,
	defaultValue,
	onChange,
	fallbackValue,
	hookName = "useControllableState",
}: UseControllableStateOptions<T>): [
	T | undefined,
	ControllableDispatch<T, T | undefined>,
] {
	// -- Controlled-mode detection --------------------------------------------
	// A hook is "controlled" when the caller provides an explicit `value` prop,
	// including `null`. Only a strictly-undefined `value` means "uncontrolled."
	const isControlled = value !== undefined;

	// -- Mode-switching guard (dev only) --------------------------------------
	// Tracks the *previous* render's mode so we can detect an actual
	// controlled <-> uncontrolled transition (not just "differs from mount").
	const wasControlledRef = useRef(isControlled);

	useEffect(() => {
		if (!isDev) return;

		if (wasControlledRef.current !== isControlled) {
			const [from, to] =
				wasControlledRef.current ?
					["controlled", "uncontrolled"]
				:	["uncontrolled", "controlled"];

			console.error(
				`[${hookName}] A component changed from ${from} to ${to}. `
					+ "This is likely caused by the `value` prop changing between "
					+ "`undefined` and a defined value. Decide at mount whether you "
					+ "want a controlled or uncontrolled hook and stick to it. "
					+ "See: https://reactjs.org/link/controlled-components",
			);
		}

		// Recorded regardless of whether we warned, so this effect only fires
		// again on the NEXT genuine transition -- otherwise, because this
		// effect's deps include `isControlled`, staying in a mismatched mode
		// across many renders would re-log the same warning on every render.
		wasControlledRef.current = isControlled;
	}, [isControlled, hookName]);

	// -- Stable onChange ref --------------------------------------------------
	// Held in a ref so the dispatcher closure never captures a stale callback —
	// callers do not need to memoize their `onChange` with `useCallback`.
	const onChangeRef = useRef(onChange);
	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	// -- Internal state (uncontrolled mode only) ------------------------------
	// Explicit `undefined` checks rather than `??`/`||`: `null` is a valid,
	// intentional value for a nullable `T` and must never be silently
	// replaced by `fallbackValue`.
	const [internalValue, setInternalValue] = useState<T | undefined>(() =>
		defaultValue !== undefined ? defaultValue : fallbackValue,
	);

	// -- Latest value ref -----------------------------------------------------
	// Gives functional updaters a fresh "prev" without a round-trip through
	// state. Kept in sync two ways:
	//   1. Optimistically, INSIDE `dispatch` itself (see below) -- so that
	//      several synchronous dispatches in the same tick chain correctly.
	//   2. Authoritatively, after every render/commit -- so that in
	//      controlled mode we always converge back to whatever `value` the
	//      parent actually rendered with (e.g. if the parent clamps/rejects
	//      the value instead of applying `onChange` verbatim).
	const latestValueRef = useRef<T | undefined>(
		isControlled ? value : internalValue,
	);
	useEffect(() => {
		latestValueRef.current = isControlled ? value : internalValue;
	});

	// -- Dispatcher -----------------------------------------------------------
	const dispatch: ControllableDispatch<T, T | undefined> = useCallback(
		(action) => {
			const prev = latestValueRef.current;
			const nextValue =
				typeof action === "function" ?
					(action as (prev: T | undefined) => T)(prev)
				:	action;

			// No-op dispatch: skip the state write AND the onChange notification.
			// Consumers wire onChange to real side effects (refetching, analytics,
			// persistence) -- notifying them when nothing actually changed invites
			// redundant work downstream. This also keeps `onChange` consistent
			// with the re-render bail-out below: "no re-render" and "no
			// notification" now always agree.
			if (Object.is(prev, nextValue)) return;

			// Sync the ref immediately (before any re-render happens). Without
			// this, two dispatches called synchronously back-to-back in the same
			// event handler would BOTH resolve `prev` from the same stale value,
			// silently dropping one of the updates -- this matters in both modes,
			// but especially in controlled mode where there's no internal
			// setState queue to fall back on.
			latestValueRef.current = nextValue;

			if (!isControlled) {
				// Defense-in-depth: `prev` above is our own optimistically-tracked
				// value, not necessarily the actual committed React state at the
				// instant this updater runs. Re-check against the real current
				// state before writing, so a stale `prev` can never cause a
				// spurious re-render even if it slips out of sync.
				setInternalValue((current) =>
					Object.is(current, nextValue) ? current : nextValue,
				);
			}

			// Fire onChange in both modes:
			//   controlled   — the only way state propagates (parent must update)
			//   uncontrolled — notification / side-effect for consumers
			onChangeRef.current?.(nextValue);
		},
		[isControlled],
	);

	// -- Resolved value -------------------------------------------------------
	const resolvedValue =
		isControlled ? value
		: internalValue !== undefined ? internalValue
		: fallbackValue;

	return [resolvedValue, dispatch];
}

export { useControllableState };
