import { createStorageAccessor } from "../../shared/storageShared/getStorage.ts";
import {
	type StorageEngineConfig,
	type UseStorageEngineReturn,
	useStorageEngine,
} from "../../shared/storageShared/useStorageEngine.ts";
import { SESSION_STORAGE_CUSTOM_EVENT } from "./constants.ts";
import type { UseSessionStorageOptions } from "./types.ts";

/**
 * Static per-storage-type wiring for `useStorageEngine`. See the identical
 * comment in `useLocalStorage.ts` for why this lives at module scope
 * rather than inside the hook body.
 *
 * `nativeStorageEventSupported: false`: sessionStorage isn't shared across
 * tabs, so the native `storage` event has no cross-tab sync role here.
 * (The one exception — same-origin iframes sharing a single tab's
 * top-level browsing context — is deliberately out of scope for this
 * hook.)
 */
const ENGINE_CONFIG: StorageEngineConfig = {
	hookLabel: "react-kit:use-session-storage",
	getStorage: createStorageAccessor("sessionStorage"),
	customEventName: SESSION_STORAGE_CUSTOM_EVENT,
	nativeStorageEventSupported: false,
};

/**
 * Reads and writes a `sessionStorage` key, kept in sync with React state.
 *
 * - Scoped to the current tab: cleared when the tab closes, and not
 *   shared with other tabs (unlike `useLocalStorage`).
 * - Stays in sync with every component in the current tab watching the
 *   same key — see {@link UseSessionStorageOptions.sameInstanceSync}.
 * - Safe under SSR: on the server, and during the client's hydration
 *   render, `value` is always `initialValue`. The real stored value is
 *   only read client-side, immediately after hydration.
 *
 * @typeParam T - The type of value being stored. Defaults to `unknown` if
 * omitted — pass an explicit type argument for anything beyond ad-hoc use.
 * @param key - The `sessionStorage` key to read and write. Changing this
 * on a later render isn't supported; the hook warns (dev console +
 * `onError`) and keeps using the original key if you do.
 * @param initialValue - Used when nothing is stored yet, as the value
 * shown before hydration completes, and as what `removeValue` resets to.
 * @param options - See {@link UseSessionStorageOptions}.
 * @returns `{ value, setValue, removeValue, isHydrated, error }`.
 *
 * @example
 * ```tsx
 * const { value: draft, setValue: setDraft } = useSessionStorage("draft-comment", "");
 *
 * <textarea value={draft ?? ""} onChange={(e) => setDraft(e.target.value)} />
 * ```
 */
function useSessionStorage<T = unknown>(
	key: string,
	initialValue?: T,
	options: UseSessionStorageOptions<T> = {},
): UseStorageEngineReturn<T> {
	return useStorageEngine(ENGINE_CONFIG, key, initialValue, options);
}

export { useSessionStorage };
export type { UseStorageEngineReturn as UseSessionStorageReturn };
