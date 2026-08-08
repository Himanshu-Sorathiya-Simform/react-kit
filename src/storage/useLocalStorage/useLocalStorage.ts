import { createStorageAccessor } from "../../shared/storageShared/getStorage.ts";
import {
	type StorageEngineConfig,
	type UseStorageEngineReturn,
	useStorageEngine,
} from "../../shared/storageShared/useStorageEngine.ts";
import { LOCAL_STORAGE_CUSTOM_EVENT } from "./constants.ts";
import type { UseLocalStorageOptions } from "./types.ts";

/**
 * Static per-storage-type wiring for `useStorageEngine`. Every field here
 * is non-reactive, so this is built once at module scope instead of
 * inside the hook body — rebuilding it on every render would also rebuild
 * the engine's internal `subscribe`/`getSnapshot` callbacks every render,
 * defeating their memoization.
 */
const ENGINE_CONFIG: StorageEngineConfig = {
	hookLabel: "react-kit:use-local-storage",
	getStorage: createStorageAccessor("localStorage"),
	customEventName: LOCAL_STORAGE_CUSTOM_EVENT,
	nativeStorageEventSupported: true,
};

/**
 * Reads and writes a `localStorage` key, kept in sync with React state.
 *
 * - Persists across page reloads and browser restarts (unlike
 *   `useSessionStorage`).
 * - Stays in sync with every component in the current tab watching the
 *   same key — see {@link UseLocalStorageOptions.sameInstanceSync} — and
 *   with other tabs/windows on the same origin — see
 *   {@link UseLocalStorageOptions.crossInstanceSync}.
 * - Safe under SSR: on the server, and during the client's hydration
 *   render, `value` is always `initialValue`. The real stored value is
 *   only read client-side, immediately after hydration.
 *
 * @typeParam T - The type of value being stored. Defaults to `unknown` if
 * omitted — pass an explicit type argument for anything beyond ad-hoc use.
 * @param key - The `localStorage` key to read and write. Changing this on
 * a later render isn't supported; the hook warns (dev console + `onError`)
 * and keeps using the original key if you do.
 * @param initialValue - Used when nothing is stored yet, as the value
 * shown before hydration completes, and as what `removeValue` resets to.
 * @param options - See {@link UseLocalStorageOptions}.
 * @returns `{ value, setValue, removeValue, isHydrated, error }`.
 *
 * @example
 * Basic usage:
 * ```tsx
 * const { value: theme, setValue: setTheme } = useLocalStorage<"light" | "dark">("theme", "light");
 *
 * <button onClick={() => setTheme(prev => (prev === "light" ? "dark" : "light"))}>
 *   Toggle theme
 * </button>
 * ```
 *
 * @example
 * With a custom serializer and error reporting:
 * ```tsx
 * const { value, setValue, error } = useLocalStorage("lastSeen", new Date(), {
 *   serializer: dateSerializer,
 *   onError: (err) => reportToErrorTracker(err),
 * });
 * ```
 */
function useLocalStorage<T = unknown>(
	key: string,
	initialValue?: T,
	options: UseLocalStorageOptions<T> = {},
): UseStorageEngineReturn<T> {
	return useStorageEngine(ENGINE_CONFIG, key, initialValue, options);
}

export { useLocalStorage };
export type { UseStorageEngineReturn as UseLocalStorageReturn };
