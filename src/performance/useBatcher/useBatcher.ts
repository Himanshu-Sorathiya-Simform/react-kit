import { useCallback, useEffect, useRef, useState } from "react";
import type { BatchOptions } from "./types.ts";
import { resolveNonNegativeNumber, resolvePositiveInteger } from "./utils.ts";

const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The object returned by `useBatcher`.
 */
interface UseBatcherReturn<Item> {
	/**
	 * Adds `item` to the current batch. Never rejected, never deferred to
	 * a future call — the item is always accepted immediately. Depending
	 * on the configured triggers, this may also cause an immediate flush
	 * (e.g. if `maxSize` is now reached).
	 */
	add: (item: Item) => void;

	/**
	 * Immediately flushes whatever is currently batched, bypassing
	 * `maxWait`/`quietPeriod` entirely. A no-op if the batch is empty —
	 * `onFlush` is never called with zero items.
	 */
	flush: () => void;

	/**
	 * Discards the current batch entirely, without ever calling
	 * `onFlush`. Clears any pending timers.
	 */
	cancel: () => void;

	/**
	 * Suspends all automatic flush triggers (`maxSize`, `maxWait`,
	 * `quietPeriod`). Items added via `add()` while paused still
	 * accumulate normally — pausing stops the flushing machinery, not the
	 * accumulation. The only way to flush while paused is a manual
	 * `flush()` call.
	 */
	pause: () => void;

	/**
	 * Resumes automatic flushing. If the batch already meets `maxSize`
	 * (because items kept arriving while paused), flushes immediately.
	 * Otherwise, re-arms `maxWait`/`quietPeriod` timers from scratch —
	 * pausing does not preserve partial progress toward either deadline;
	 * resuming starts a fresh clock for whatever's still batched.
	 */
	resume: () => void;

	/** The number of items currently in the batch. */
	size: number;

	/** `true` whenever `size > 0`. */
	isPending: boolean;

	/** `true` after `pause()`, until the next `resume()`. */
	isPaused: boolean;
}

/**
 * Groups rapid, individual `add()` calls into batches, flushing the whole
 * accumulated group to `onFlush` at once — instead of debouncing,
 * throttling, or rate-limiting, all of which discard some calls along the
 * way. Nothing added to a `useBatcher` is ever dropped; it's only ever
 * grouped.
 *
 * A batch flushes when any configured trigger fires first: reaching
 * `maxSize` items, `maxWait` milliseconds since the batch's first item,
 * or `quietPeriod` milliseconds of no new items. All three are optional
 * and can be combined freely. If none are configured, only a manual
 * `flush()` call ever empties the batch.
 *
 * Unlike the debounce/throttle/rate-limit hook families, there's no
 * separate `Callback`/`State`/`Value` wrapper — `onFlush` is a single
 * fixed handler (captured in a ref and always current, so a fresh inline
 * function on every render is safe), and live access to the current batch
 * contents is available via the `onItemsChange` option instead of a
 * dedicated hook.
 *
 * @example
 * ```tsx
 * function AnalyticsProvider({ children }: { children: React.ReactNode }) {
 *   const { add } = useBatcher<AnalyticsEvent>(
 *     (events) => sendAnalyticsBatch(events),
 *     { maxSize: 20, maxWait: 5000 },
 *   );
 *
 *   // `track` can be called as often as needed — events are grouped and
 *   // sent in batches of up to 20, at least once every 5 seconds.
 *   const track = (event: AnalyticsEvent) => add(event);
 *
 *   return (
 *     <AnalyticsContext.Provider value={{ track }}>
 *       {children}
 *     </AnalyticsContext.Provider>
 *   );
 * }
 * ```
 *
 * @param onFlush - Called with every item accumulated since the last
 * flush, as a snapshot array. Safe to pass a fresh inline function on
 * every render.
 * @param options - See {@link BatchOptions}.
 * @returns See {@link UseBatcherReturn}.
 */
function useBatcher<Item>(
	onFlush: (items: readonly Item[]) => void,
	options: BatchOptions<Item> = {},
): UseBatcherReturn<Item> {
	if (isDev && typeof onFlush !== "function") {
		console.warn(
			`[useBatcher] Expected \`onFlush\` to be a function, received ${typeof onFlush}.`,
		);
	}

	const safeMaxSize = resolvePositiveInteger(options?.maxSize);
	const safeMaxWait = resolveNonNegativeNumber(options?.maxWait);
	const safeQuietPeriod = resolveNonNegativeNumber(options?.quietPeriod);

	if (isDev && options?.maxSize !== undefined && safeMaxSize === undefined) {
		console.warn(
			`[useBatcher] \`maxSize\` (${String(options.maxSize)}) must be a positive integer — ignoring it.`,
		);
	}

	if (isDev && options?.maxWait !== undefined && safeMaxWait === undefined) {
		console.warn(
			`[useBatcher] \`maxWait\` (${String(options.maxWait)}) must be a non-negative number — ignoring it.`,
		);
	}

	if (
		isDev
		&& options?.quietPeriod !== undefined
		&& safeQuietPeriod === undefined
	) {
		console.warn(
			`[useBatcher] \`quietPeriod\` (${String(options.quietPeriod)}) must be a non-negative number — ignoring it.`,
		);
	}

	if (
		isDev
		&& safeMaxSize === undefined
		&& safeMaxWait === undefined
		&& safeQuietPeriod === undefined
	) {
		console.warn(
			"[useBatcher] No `maxSize`, `maxWait`, or `quietPeriod` configured — items will only flush when `flush()` is called manually.",
		);
	}

	if (
		isDev
		&& safeMaxWait !== undefined
		&& safeQuietPeriod !== undefined
		&& safeQuietPeriod >= safeMaxWait
	) {
		console.warn(
			`[useBatcher] \`quietPeriod\` (${safeQuietPeriod}ms) is not shorter than \`maxWait\` (${safeMaxWait}ms) — \`maxWait\` will almost always fire first, making \`quietPeriod\` unreachable in practice.`,
		);
	}

	if (
		isDev
		&& options?.onItemsChange !== undefined
		&& typeof options.onItemsChange !== "function"
	) {
		console.warn(
			"[useBatcher] `onItemsChange` must be a function — ignoring the provided value.",
		);
	}

	const [size, setSize] = useState(0);
	const [isPaused, setIsPaused] = useState(false);

	// The actual buffer. `size` (state) exists only to make its length
	// reactive for rendering — every mutation here is paired with a
	// `setSize` call to keep the two in sync.
	const bufferRef = useRef<Item[]>([]);
	const isPausedRef = useRef(false);

	// `maxWait` is armed once per batch and left alone until it fires or
	// the batch ends some other way. `quietPeriod` is cleared and
	// re-armed on every single `add()` call — that's the entire
	// difference between the two trigger semantics.
	const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const quietPeriodTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const onFlushRef = useRef(onFlush);
	const onItemsChangeRef = useRef(
		typeof options?.onItemsChange === "function" ?
			options.onItemsChange
		:	undefined,
	);

	useEffect(() => {
		onFlushRef.current = onFlush;
	}, [onFlush]);

	useEffect(() => {
		onItemsChangeRef.current =
			typeof options?.onItemsChange === "function" ?
				options.onItemsChange
			:	undefined;
	}, [options?.onItemsChange]);

	const notifyItemsChange = useCallback(() => {
		// Copies the buffer — `bufferRef.current` keeps getting mutated by
		// future `add()` calls, so handing out the live array would let a
		// consumer's stored reference change out from under them.
		onItemsChangeRef.current?.([...bufferRef.current]);
	}, []);

	const clearTimers = useCallback(() => {
		if (maxWaitTimerRef.current !== null) {
			clearTimeout(maxWaitTimerRef.current);
			maxWaitTimerRef.current = null;
		}

		if (quietPeriodTimerRef.current !== null) {
			clearTimeout(quietPeriodTimerRef.current);
			quietPeriodTimerRef.current = null;
		}
	}, []);

	// Only clears pending timers on unmount — does NOT flush whatever's
	// still buffered. A batch in progress when the component unmounts is
	// abandoned, same as `cancel()`, not delivered. Call `flush()`
	// explicitly beforehand if guaranteed delivery matters for a given
	// use case.
	useEffect(() => {
		return clearTimers;
	}, [clearTimers]);

	const flush = useCallback(() => {
		clearTimers();

		if (bufferRef.current.length === 0) return;

		// Reassigning to a new array (rather than mutating and copying)
		// transfers ownership of the old array to `items` — safe to hand
		// straight to `onFlush` without a copy, since nothing else will
		// ever touch it again.
		const items = bufferRef.current;

		bufferRef.current = [];

		setSize(0);

		notifyItemsChange();

		onFlushRef.current(items);
	}, [clearTimers, notifyItemsChange]);

	const cancel = useCallback(() => {
		clearTimers();

		bufferRef.current = [];

		setSize(0);

		notifyItemsChange();
	}, [clearTimers, notifyItemsChange]);

	const pause = useCallback(() => {
		isPausedRef.current = true;

		clearTimers();

		setIsPaused(true);
	}, [clearTimers]);

	const resume = useCallback(() => {
		isPausedRef.current = false;

		setIsPaused(false);

		if (bufferRef.current.length === 0) return;

		if (safeMaxSize !== undefined && bufferRef.current.length >= safeMaxSize) {
			flush();
			return;
		}

		if (safeMaxWait !== undefined) {
			maxWaitTimerRef.current = setTimeout(() => {
				maxWaitTimerRef.current = null;
				flush();
			}, safeMaxWait);
		}

		if (safeQuietPeriod !== undefined) {
			quietPeriodTimerRef.current = setTimeout(() => {
				quietPeriodTimerRef.current = null;
				flush();
			}, safeQuietPeriod);
		}
	}, [safeMaxSize, safeMaxWait, safeQuietPeriod, flush]);

	const add = useCallback(
		(item: Item) => {
			const isNewBatch = bufferRef.current.length === 0;

			bufferRef.current.push(item);

			setSize(bufferRef.current.length);

			notifyItemsChange();

			if (isPausedRef.current) return;

			// Checked first, before scheduling anything — if this item
			// pushes the batch to maxSize, there's no point arming a
			// quietPeriod timer we're about to immediately discard.
			if (
				safeMaxSize !== undefined
				&& bufferRef.current.length >= safeMaxSize
			) {
				flush();
				return;
			}

			// Only starts once per batch (`isNewBatch`) — maxWait measures
			// from the first item, not the most recent one, and is never
			// pushed out by later adds the way quietPeriod is.
			if (isNewBatch && safeMaxWait !== undefined) {
				maxWaitTimerRef.current = setTimeout(() => {
					maxWaitTimerRef.current = null;
					flush();
				}, safeMaxWait);
			}

			// Unlike maxWait, this reschedules on every single add — it's
			// measuring "how long since the most recent item," not "how
			// long has this batch existed."
			if (safeQuietPeriod !== undefined) {
				if (quietPeriodTimerRef.current !== null) {
					clearTimeout(quietPeriodTimerRef.current);
				}

				quietPeriodTimerRef.current = setTimeout(() => {
					quietPeriodTimerRef.current = null;
					flush();
				}, safeQuietPeriod);
			}
		},
		[safeMaxSize, safeMaxWait, safeQuietPeriod, flush, notifyItemsChange],
	);

	return {
		add,
		flush,
		cancel,
		pause,
		resume,
		size,
		isPending: size > 0,
		isPaused,
	};
}

export { type UseBatcherReturn, useBatcher };
