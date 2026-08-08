/**
 * Defines how a value of type `T` is converted to and from the string
 * format that `localStorage`/`sessionStorage` can actually store — the Web
 * Storage API only ever stores strings.
 *
 * Implement this to store types the default JSON-based serializer can't
 * round-trip faithfully, e.g. `Map`, `Set`, `Date`, or `bigint` — see
 * `mapSerializer`, `setSerializer`, `dateSerializer`, and
 * `bigIntSerializer` in `serializers.ts` for ready-made ones.
 *
 * @typeParam T - The in-memory value type this serializer handles.
 */
interface StorageSerializer<T> {
	/** Converts an in-memory value into the string that gets stored. */
	serialize: (value: T) => string;

	/**
	 * Converts a stored string back into an in-memory value.
	 *
	 * @throws If the raw string can't be converted back into `T`. The hook
	 * catches this, falls back to `initialValue`, and reports the error —
	 * see `onError` on {@link BaseStorageOptions}.
	 */
	deserialize: (raw: string) => T;
}

/**
 * Options shared by `useLocalStorage` and `useSessionStorage`.
 *
 * @typeParam T - The type of value being stored.
 */
interface BaseStorageOptions<T> {
	/**
	 * Custom (de)serializer for values that don't round-trip through
	 * `JSON.stringify`/`JSON.parse` cleanly.
	 *
	 * @defaultValue `defaultSerializer` (plain `JSON.stringify`/`JSON.parse`)
	 */
	serializer?: StorageSerializer<T>;

	/**
	 * Whether to synchronously read the existing stored value on mount.
	 *
	 * - `true` (default): `value` reflects storage from the very first
	 *   render it's allowed to (see the SSR note below).
	 * - `false`: `value` starts as `undefined` and only reflects storage
	 *   once `isHydrated` becomes `true`, one render after mount. Use this
	 *   if you'd rather render a loading/skeleton state than briefly show a
	 *   value that might change right after.
	 *
	 * Either way, on the server — and during the client's hydration render
	 * — `value` is always `initialValue`. This option only affects timing
	 * on the client, after that point.
	 *
	 * @defaultValue `true`
	 */
	initializeWithValue?: boolean;

	/**
	 * Whether other instances of this hook watching the *same key* in the
	 * *same tab* stay in sync with each other. Implemented via a
	 * `CustomEvent` dispatched on `window` — the browser's native `storage`
	 * event never fires in the tab that made the change, so without this,
	 * two components reading the same key in one tab would drift apart.
	 *
	 * @defaultValue `true`
	 */
	sameInstanceSync?: boolean;

	/**
	 * Called whenever the hook hits an unexpected condition: a failed
	 * read, a failed write, a failed cross-instance deserialize, or an
	 * attempt to change the storage key at runtime. Fires in every
	 * environment, including production — use this for telemetry/error
	 * reporting.
	 *
	 * This is *not* a replacement for the dev-only `console.warn` the hook
	 * also emits for the same conditions (visible when
	 * `process.env.NODE_ENV !== "production"`) — both fire independently.
	 */
	onError?: (error: Error) => void;
}

/**
 * Payload carried by the same-tab `CustomEvent` used for
 * {@link BaseStorageOptions.sameInstanceSync}. Internal — not part of the
 * public hook API, but exported so `useStorageEngine.ts` can import it.
 */
interface StorageCustomEventDetail {
	/** The new serialized value, or `null` if the key was removed. */
	value: string | null;

	/**
	 * A per-hook-instance identifier, used so an instance can recognize —
	 * and ignore — the event it just dispatched itself.
	 */
	instanceId: symbol;
}

export type { BaseStorageOptions, StorageCustomEventDetail, StorageSerializer };
