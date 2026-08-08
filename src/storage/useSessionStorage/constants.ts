/**
 * Base name for the `CustomEvent` used to sync `useSessionStorage`
 * instances within the same tab. The watched key is appended to this at
 * dispatch/listen time — see `useStorageEngine.ts`.
 */
const SESSION_STORAGE_CUSTOM_EVENT = "react-kit:use-session-storage" as const;

export { SESSION_STORAGE_CUSTOM_EVENT };
