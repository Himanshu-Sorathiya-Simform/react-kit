import {
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { defaultSerializer } from "./serializers.ts";
import type {
	BaseStorageOptions,
	StorageCustomEventDetail,
	StorageSerializer,
} from "./types.ts";

/**
 * Dev-environment detector, used to gate the `console.warn` calls in this
 * file.
 *
 * Deliberately re-declared here rather than imported from the events
 * package's `useEventListener.ts` file (which has the identical snippet),
 * to keep this file decoupled from it — the two are unrelated internals
 * that just happen to need the same tiny check.
 *
 * Reads `process.env.NODE_ENV` through `globalThis` so this works without
 * `@types/node` (no ambient `process` type required). If the environment
 * can't be determined at all (e.g. an edge runtime with no `process`),
 * this defaults to `true` — better to over-warn in an unusual environment
 * than silently hide a real misconfiguration.
 */
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * The storage-type-specific pieces {@link useStorageEngine} needs, supplied
 * by the thin per-storage-type wrapper hooks (`useLocalStorage.ts`,
 * `useSessionStorage.ts`).
 *
 * Every field here is static/non-reactive — both wrapper hooks build one
 * `StorageEngineConfig` object at module scope and reuse it across
 * renders, rather than rebuilding it inside the hook body. That's what
 * keeps the engine's internal callbacks (`subscribe`, `getSnapshot`, ...)
 * referentially stable across renders.
 */
interface StorageEngineConfig {
	/**
	 * Prefix used in dev-mode `console.warn` messages, e.g.
	 * `"react-kit:use-local-storage"`.
	 */
	hookLabel: string;

	/** Resolves the underlying `Storage` object for this storage type. */
	getStorage: () => Storage | null;

	/**
	 * Base name for the same-tab `CustomEvent` used for
	 * {@link BaseStorageOptions.sameInstanceSync}. The watched key is
	 * appended to this (as `` `${customEventName}:${key}` ``) so each key
	 * gets its own event name, and a listener only ever receives events
	 * for the key it actually cares about.
	 */
	customEventName: string;

	/**
	 * Whether the native `"storage"` window event is meaningful for this
	 * storage type.
	 *
	 * `true` for localStorage: it's shared across tabs, and the browser
	 * fires `"storage"` in every *other* same-origin tab when it changes.
	 *
	 * `false` for sessionStorage in the common case: each tab has its own
	 * isolated sessionStorage, so there's nothing to sync across tabs.
	 * (The one exception — same-origin iframes sharing a single tab's
	 * top-level browsing context — is deliberately out of scope here; see
	 * the note in `useSessionStorage.ts`.)
	 */
	nativeStorageEventSupported: boolean;
}

/**
 * Options accepted by {@link useStorageEngine}.
 *
 * `crossInstanceSync` lives here rather than on {@link BaseStorageOptions}
 * because it only makes sense when
 * {@link StorageEngineConfig.nativeStorageEventSupported} is `true` —
 * `useSessionStorage`'s public options type deliberately omits it.
 *
 * @typeParam T - The type of value being stored.
 */
interface StorageEngineOptions<T> extends BaseStorageOptions<T> {
	/**
	 * Whether this instance should sync with the *same key* changing in
	 * *other tabs/windows*, via the browser's native `storage` event. Has
	 * no effect if the config this engine was built with doesn't support
	 * the native event (sessionStorage).
	 *
	 * @defaultValue `true`
	 */
	crossInstanceSync?: boolean;
}

/**
 * The shape returned by {@link useStorageEngine} — and, re-exported, by
 * both `useLocalStorage` and `useSessionStorage`.
 *
 * @typeParam T - The type of value being stored.
 */
interface UseStorageEngineReturn<T> {
	/**
	 * The current value.
	 *
	 * - `undefined` if nothing is stored yet and no `initialValue` was
	 *   given, or — when `initializeWithValue: false` — before hydration
	 *   completes.
	 * - On the server, and during the client's hydration render, this is
	 *   always `initialValue`: real storage can only be read client-side,
	 *   and reading it any earlier would produce a hydration mismatch.
	 */
	value: T | undefined;

	/**
	 * Writes a new value to storage. Accepts either the value directly, or
	 * an updater function that receives the current value and returns the
	 * next one — the same convention as `useState`'s setter.
	 *
	 * A no-op if storage isn't available (SSR, or storage access blocked).
	 */
	setValue: (valueOrUpdater: T | ((prev: T | undefined) => T)) => void;

	/**
	 * Removes the key from storage entirely and resets `value` back to
	 * whatever `initialValue` was passed to the hook.
	 *
	 * A no-op if storage isn't available (SSR, or storage access blocked).
	 */
	removeValue: () => void;

	/**
	 * `true` once the client has mounted and the hook has settled on its
	 * real (non-server-snapshot) value. Useful for showing a loading state
	 * instead of a value that might change the instant hydration finishes.
	 */
	isHydrated: boolean;

	/**
	 * The most recent error the hook encountered — a failed read, write,
	 * or cross-instance sync, or an attempted key change — or `null` if
	 * nothing has gone wrong (or an error was cleared by a subsequent
	 * successful write/remove). See `onError` on {@link BaseStorageOptions}
	 * for an imperative alternative to reading this reactively.
	 */
	error: Error | null;
}

/**
 * Attempts to deserialize a raw stored string, falling back to a default
 * value instead of throwing on failure.
 *
 * Kept as a free function, separate from the error-*reporting* logic in
 * {@link useStorageEngine}, specifically so it stays pure — it's called
 * from `getSnapshot`, which React requires to have no side effects (see
 * the comment above `getSnapshot` for why that matters).
 *
 * @typeParam T - The type the raw string should deserialize into.
 * @param raw - The raw string read from storage.
 * @param serializer - Supplies the actual `deserialize` implementation.
 * @param fallback - Returned if `deserialize` throws.
 */
function tryDeserialize<T>(
	raw: string,
	serializer: StorageSerializer<T>,
	fallback: T | undefined,
): T | undefined {
	try {
		return serializer.deserialize(raw);
	} catch {
		return fallback;
	}
}

/**
 * Internal engine shared by `useLocalStorage` and `useSessionStorage`. Not
 * part of the public API — both hooks are thin wrappers that supply a
 * {@link StorageEngineConfig} and forward their own arguments here.
 *
 * Built on `useSyncExternalStore` rather than plain `useState`, so it's
 * safe under SSR: `getServerSnapshot` always returns `initialValue`,
 * guaranteeing the server-rendered output and the client's hydration
 * render match exactly. React's own tearing/consistency check then
 * reconciles to the real client-side value immediately after hydration —
 * see the `getSnapshot`/`getServerSnapshot` comments below.
 *
 * @typeParam T - The type of value being stored.
 * @param config - Storage-type-specific behavior, supplied by the calling wrapper hook.
 * @param key - The storage key to read and write.
 * @param initialValue - Used when nothing is stored yet, and as the value
 * shown server-side / before hydration completes.
 * @param options - See {@link StorageEngineOptions}.
 */
function useStorageEngine<T = unknown>(
	config: StorageEngineConfig,
	key: string,
	initialValue: T | undefined,
	options: StorageEngineOptions<T> = {},
): UseStorageEngineReturn<T> {
	const {
		serializer = defaultSerializer as StorageSerializer<T>,
		initializeWithValue = true,
		sameInstanceSync = true,
		crossInstanceSync = true,
		onError,
	} = options;

	// `key` is locked to whatever it was on the first render — changing it
	// on a later render isn't supported (see the effect below). This
	// mirrors how `useState(initialValue)` only ever honors its argument on
	// the very first call.
	const [stableKey] = useState<string>(() => key);
	const keyChanged = key !== stableKey;

	// A per-mount identity for this hook instance, used purely so its own
	// same-tab CustomEvent dispatches can be recognized — and ignored — by
	// its own listener; see `subscribe` below. Lazily assigned instead of
	// `useRef(Symbol())`, since the latter would construct a throwaway
	// `Symbol()` on every render: `useRef`, unlike `useState`, has no lazy
	// initializer form, so its argument is evaluated eagerly every render
	// even though only the very first render's value is ever kept.
	const [instanceId] = useState<symbol>(() => Symbol());

	// `serializer`/`initialValue`/`onError` are mirrored into refs, kept in
	// sync via effect, so that callbacks which must stay referentially
	// stable (setValue, removeValue, getSnapshot's dependency-triggered
	// recreation) can still always read the *latest* value without
	// themselves needing to be rebuilt every time one of these changes.
	const serializerRef = useRef(serializer);
	useEffect(() => {
		serializerRef.current = serializer;
	}, [serializer]);

	const initialValueRef = useRef(initialValue);
	useEffect(() => {
		initialValueRef.current = initialValue;
	}, [initialValue]);

	const onErrorRef = useRef(onError);
	useEffect(() => {
		onErrorRef.current = onError;
	}, [onError]);

	const [error, setError] = useState<Error | null>(null);

	/**
	 * Single entry point for every "something unexpected happened" case in
	 * this hook: the dev-mode console warning, the `onError` callback, and
	 * the reactive `error` state all happen here, together, so no call
	 * site can accidentally do only one or two of the three.
	 */
	const reportError = useCallback(
		(message: string, err: Error): void => {
			if (isDev) {
				console.warn(`[${config.hookLabel}] ${message}:`, err.message);
			}

			onErrorRef.current?.(err);
			setError(err);
		},
		[config.hookLabel],
	);

	// Warns (once per actual key transition) if the caller passes a
	// different `key` on a later render. Silently switching keys would be
	// surprising/likely-buggy behavior — e.g. any pending same-tab sync
	// events for the *old* key would be lost — so this is treated as a
	// reportable error rather than honored.
	useEffect(() => {
		if (!keyChanged) return;

		// eslint-disable-next-line react-hooks/set-state-in-effect
		reportError(
			"Ignoring key change",
			new Error(
				`Changing the storage key at runtime is not supported. `
					+ `Still using original key: "${stableKey}". Received new key: "${key}".`,
			),
		);
	}, [key, keyChanged, stableKey, reportError]);

	// `useSyncExternalStore`'s `getSnapshot` must return a referentially
	// *stable* value when nothing has actually changed, since React
	// compares by reference. Naively re-running `JSON.parse` on every call
	// would break that and cause an infinite render loop. This cache keeps
	// the last raw string alongside its parsed result, per hook instance,
	// so re-parsing only happens when the raw string genuinely changes.
	const cacheRef = useRef<{ raw: string | null; parsed: T | undefined }>({
		raw: null,
		parsed: initialValue,
	});

	// useSyncExternalStore hands `subscribe` (below) an `onStoreChange`
	// callback that, when called, tells React to re-run `getSnapshot` and
	// re-render if the result changed. This ref captures that callback so
	// `setValue`/`removeValue` can call it directly — guaranteeing *this*
	// instance reflects its own write immediately, regardless of whether
	// `sameInstanceSync` is even enabled (that option only governs syncing
	// with *other* instances, not with the instance that made the change).
	const notifyRef = useRef<(() => void) | null>(null);

	/**
	 * The `getSnapshot` function passed to `useSyncExternalStore`.
	 *
	 * Must stay pure — no `setState`, no calling `onError`/`reportError` —
	 * because React is explicitly allowed to call this more than once per
	 * render (e.g. to check for tearing), so any side effect placed here
	 * could fire an unpredictable number of times, or at an unexpected
	 * point in the render lifecycle. Read-error *reporting* happens
	 * separately, in the effect further below.
	 */
	const getSnapshot = useCallback((): T | undefined => {
		const storage = config.getStorage();

		if (!storage) return initialValueRef.current;

		const raw = storage.getItem(stableKey);

		// Nothing changed since the last read — return the cached parsed
		// value so React sees a stable reference and doesn't re-render.
		if (cacheRef.current.raw === raw) return cacheRef.current.parsed;

		const parsed =
			raw === null ?
				initialValueRef.current
			:	tryDeserialize(raw, serializerRef.current, initialValueRef.current);

		cacheRef.current = { raw, parsed };

		return parsed;
		// `config`/`serializerRef`/`initialValueRef` intentionally omitted:
		// `config` is a stable, module-scoped object (see the wrapper
		// hooks), and the refs are, by design, always read fresh at call
		// time rather than captured — including them would only cause
		// unnecessary recreations of this callback.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stableKey]);

	/**
	 * The `getServerSnapshot` function passed to `useSyncExternalStore`.
	 * Always `initialValue` — storage genuinely doesn't exist on the
	 * server, and this is also what's used for the client's very first
	 * (hydration) render, so server and client output match exactly and
	 * React never reports a hydration mismatch for this value.
	 */
	const getServerSnapshot = useCallback(
		(): T | undefined => initialValueRef.current,
		[],
	);

	/**
	 * The `subscribe` function passed to `useSyncExternalStore`. Called by
	 * React itself — not by this component's own render — which is why it
	 * uses raw `addEventListener`/`AbortController` here instead of this
	 * project's `useEventListener` hook: hooks can only be called from a
	 * component's own render, and this function isn't one.
	 */
	const subscribe = useCallback(
		(onStoreChange: () => void): (() => void) => {
			notifyRef.current = onStoreChange;

			// SSR / non-browser environment: nothing to subscribe to.
			if (typeof window === "undefined") {
				return () => {
					notifyRef.current = null;
				};
			}

			// One AbortController drives cleanup for both listeners below —
			// aborting it removes whichever of them actually got attached.
			const controller = new AbortController();

			if (crossInstanceSync && config.nativeStorageEventSupported) {
				window.addEventListener(
					"storage",
					(event: StorageEvent) => {
						// Ignore events for a different Storage object, and
						// events for a different key.
						if (event.storageArea !== config.getStorage()) return;
						// `event.key` is `null` specifically when the change was a
						// `storage.clear()` call — treat that as "this key
						// changed too", since clear() wipes every key, including
						// this one.
						if (event.key !== null && event.key !== stableKey) return;

						onStoreChange();
					},
					{ signal: controller.signal },
				);
			}

			if (sameInstanceSync) {
				window.addEventListener(
					`${config.customEventName}:${stableKey}`,
					(event: Event) => {
						const detail = (
							event as CustomEvent<StorageCustomEventDetail>
						).detail;

						// Skip the event this exact instance just dispatched — it
						// already notified itself directly via notifyRef inside
						// setValue/removeValue, without waiting for the round trip
						// through window.dispatchEvent.
						if (detail.instanceId === instanceId) return;

						onStoreChange();
					},
					{ signal: controller.signal },
				);
			}

			return () => {
				controller.abort();
				notifyRef.current = null;
			};
		},
		[stableKey, crossInstanceSync, sameInstanceSync, config, instanceId],
	);

	const liveValue = useSyncExternalStore(
		subscribe,
		getSnapshot,
		getServerSnapshot,
	);

	// Flips to true exactly once, in an effect — so never on the server,
	// and never during the client's hydration render, only after mount.
	// Used below to implement `initializeWithValue: false`'s "start as
	// undefined, then reveal the real value" behavior.
	const [isHydrated, setIsHydrated] = useState(false);
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setIsHydrated(true);
	}, []);

	// When `initializeWithValue` is true (the default), always expose the
	// real (or server) snapshot. When it's false, withhold it until
	// `isHydrated` flips. `liveValue` itself is already correct underneath
	// the whole time either way — this is purely about what's *exposed* to
	// the consumer, and when.
	const value = initializeWithValue || isHydrated ? liveValue : undefined;

	// Detects deserialize failures for whatever is *currently* stored, and
	// reports them — dev warning + onError + `error` state — exactly once
	// per distinct raw value. This intentionally duplicates the parsing
	// `getSnapshot` already does above: it can't reuse getSnapshot's result
	// directly, because reporting is a side effect and getSnapshot must
	// stay side-effect-free (see the comment on `getSnapshot`). Runs after
	// every render, but the `lastCheckedRawRef` guard makes it a cheap
	// no-op unless the raw string actually changed — including catching
	// "storage already contained invalid data when this component mounted".
	const lastCheckedRawRef = useRef<string | null>(undefined);
	useEffect(() => {
		const storage = config.getStorage();

		if (!storage) return;

		const raw = storage.getItem(stableKey);

		if (raw === lastCheckedRawRef.current) return;

		lastCheckedRawRef.current = raw;

		if (raw === null) return;

		try {
			serializerRef.current.deserialize(raw);
		} catch (err) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			reportError(
				`Failed to read key "${stableKey}"`,
				err instanceof Error ? err : new Error(String(err)),
			);
		}
	});

	const setValue = useCallback(
		(valueOrUpdater: T | ((prev: T | undefined) => T)): void => {
			const storage = config.getStorage();

			if (!storage) return;

			// Read fresh via getSnapshot rather than trusting a separately
			// tracked "last known value" ref — that avoids a classic bug
			// where calling setValue(prev => ...) twice synchronously (e.g.
			// in the same event handler) would see the same stale `prev`
			// both times, since a ref updated only inside an effect wouldn't
			// have caught up yet between the two calls.
			const prev = getSnapshot();
			const next =
				typeof valueOrUpdater === "function" ?
					(valueOrUpdater as (prev: T | undefined) => T)(prev)
				:	valueOrUpdater;

			try {
				const serialized = serializerRef.current.serialize(next);
				storage.setItem(stableKey, serialized);

				// Keep this instance's own cache/error-tracking in sync
				// immediately, rather than waiting for a render + effect pass.
				cacheRef.current = { raw: serialized, parsed: next };
				lastCheckedRawRef.current = serialized;
				setError(null);

				// Always notify *this* instance directly — independent of
				// sameInstanceSync, which only controls whether *other*
				// instances hear about the change (see the dispatch below).
				notifyRef.current?.();

				if (sameInstanceSync) {
					const detail: StorageCustomEventDetail = {
						value: serialized,
						instanceId: instanceId!,
					};

					window.dispatchEvent(
						new CustomEvent(`${config.customEventName}:${stableKey}`, {
							detail,
						}),
					);
				}
			} catch (err) {
				// Most commonly: the serializer threw, or storage.setItem threw
				// (e.g. QuotaExceededError, or storage disabled entirely).
				reportError(
					`Failed to write key "${stableKey}"`,
					err instanceof Error ? err : new Error(String(err)),
				);
			}
		},
		[config, stableKey, sameInstanceSync, getSnapshot, reportError, instanceId],
	);

	const removeValue = useCallback((): void => {
		const storage = config.getStorage();

		if (!storage) return;

		storage.removeItem(stableKey);

		// Mirrors setValue's bookkeeping above, resetting to initialValue
		// instead of a newly-written value.
		cacheRef.current = { raw: null, parsed: initialValueRef.current };
		lastCheckedRawRef.current = null;
		setError(null);
		notifyRef.current?.();

		if (sameInstanceSync) {
			const detail: StorageCustomEventDetail = {
				value: null,
				instanceId: instanceId!,
			};

			window.dispatchEvent(
				new CustomEvent(`${config.customEventName}:${stableKey}`, {
					detail,
				}),
			);
		}
	}, [config, stableKey, sameInstanceSync, instanceId]);

	return { value, setValue, removeValue, isHydrated, error };
}

export { type StorageEngineConfig, type UseStorageEngineReturn, useStorageEngine };
