import type { BaseStorageOptions } from "../../shared/storageShared/types.ts";

/**
 * Options accepted by `useLocalStorage`.
 *
 * @typeParam T - The type of value being stored.
 */
interface UseLocalStorageOptions<T> extends BaseStorageOptions<T> {
	/**
	 * Whether this hook instance should sync with the same key changing in
	 * *other tabs/windows* on the same origin, via the browser's native
	 * `storage` event. Has no `sessionStorage` equivalent — sessionStorage
	 * isn't shared across tabs, so there's nothing to sync in that case.
	 *
	 * @defaultValue `true`
	 */
	crossInstanceSync?: boolean;
}

export type { UseLocalStorageOptions };
