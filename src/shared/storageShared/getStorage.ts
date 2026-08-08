/**
 * Builds a function that safely resolves `window.localStorage` or
 * `window.sessionStorage`.
 *
 * Wraps the access in a `typeof window` check — so it returns `null`
 * rather than throwing during SSR, where `window` doesn't exist — and a
 * `try`/`catch`, so it also returns `null` rather than throwing in
 * environments where storage access itself throws (e.g. some browsers'
 * private-browsing modes, or storage disabled via user/enterprise policy).
 *
 * @param storageType - Which Web Storage API to resolve.
 * @returns A zero-argument function returning the `Storage` object, or
 * `null` if it isn't available right now.
 *
 * @example
 * ```ts
 * const getLocalStorage = createStorageAccessor("localStorage");
 * const storage = getLocalStorage(); // Storage | null
 * ```
 */
function createStorageAccessor(
	storageType: "localStorage" | "sessionStorage",
): () => Storage | null {
	return () => {
		if (typeof window === "undefined") return null;

		try {
			return window[storageType];
		} catch {
			return null;
		}
	};
}

export { createStorageAccessor };
