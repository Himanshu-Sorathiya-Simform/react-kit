import type { BaseStorageOptions } from "../../shared/storageShared/types.ts";

/**
 * Options accepted by `useSessionStorage`. Identical to
 * `BaseStorageOptions` — unlike `UseLocalStorageOptions`, there's no
 * `crossInstanceSync` option here, since sessionStorage isn't shared
 * across tabs in the first place.
 *
 * @typeParam T - The type of value being stored.
 */
type UseSessionStorageOptions<T> = BaseStorageOptions<T>;

export type { UseSessionStorageOptions };
