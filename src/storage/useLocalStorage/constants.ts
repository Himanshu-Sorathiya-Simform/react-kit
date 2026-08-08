/**
 * Base name for the `CustomEvent` used to sync `useLocalStorage` instances
 * within the same tab. The watched key is appended to this at dispatch/
 * listen time — see `useStorageEngine.ts`.
 */
const LOCAL_STORAGE_CUSTOM_EVENT = "react-kit:use-local-storage" as const;

export { LOCAL_STORAGE_CUSTOM_EVENT };
