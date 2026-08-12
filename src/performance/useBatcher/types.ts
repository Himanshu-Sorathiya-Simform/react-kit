/**
 * Configuration for `useBatcher`.
 *
 * All three flush triggers (`maxSize`, `maxWait`, `quietPeriod`) are
 * optional and independent — configure any combination, and whichever
 * condition is met first triggers the flush. If none are configured, the
 * batch only ever flushes when `flush()` is called manually.
 */
interface BatchOptions<Item> {
	/**
	 * Flushes the batch immediately once it reaches this many items.
	 * Checked on every `add()` call, before either timer-based trigger is
	 * considered.
	 *
	 * Invalid input (not a positive number) is ignored — not clamped to a
	 * fallback — with a dev-mode warning, since there's no sensible
	 * default size to fall back to.
	 *
	 * @defaultValue `undefined` (no size ceiling)
	 */
	maxSize?: number;

	/**
	 * A hard ceiling, in milliseconds, on how long a batch can sit before
	 * flushing — measured from the moment the *first* item of the current
	 * batch was added, not the most recent one. Guarantees a maximum
	 * latency per item regardless of how long the batch keeps growing.
	 *
	 * Invalid input (not a non-negative number) is ignored with a dev-mode
	 * warning.
	 *
	 * @defaultValue `undefined` (no time ceiling)
	 */
	maxWait?: number;

	/**
	 * Flushes the batch once this many milliseconds pass with no further
	 * items added — resets on every `add()` call, unlike `maxWait`. Use
	 * this when you want to wait for activity to genuinely settle before
	 * flushing, rather than enforcing a hard per-item latency ceiling.
	 *
	 * If both `maxWait` and `quietPeriod` are configured and `quietPeriod`
	 * is not shorter than `maxWait`, `maxWait` will almost always win the
	 * race — a dev-mode warning flags this combination.
	 *
	 * Invalid input (not a non-negative number) is ignored with a dev-mode
	 * warning.
	 *
	 * @defaultValue `undefined` (no quiet-period trigger)
	 */
	quietPeriod?: number;

	/**
	 * Called with a snapshot of the current batch contents every time it
	 * changes — after every `add()`, and after every flush or `cancel()`
	 * (with an empty array). This is the mechanism for getting live,
	 * reactive access to what's currently queued (e.g. a "3 items
	 * queued…" indicator) without `useBatcher` itself needing to hold the
	 * full item list in React state.
	 *
	 * Safe to pass a fresh inline function on every render — it's captured
	 * in a ref and refreshed via effect, same as `onFlush`.
	 *
	 * @defaultValue `undefined`
	 */
	onItemsChange?: (items: readonly Item[]) => void;
}

export type { BatchOptions };
