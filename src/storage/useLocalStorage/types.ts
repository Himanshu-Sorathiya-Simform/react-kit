import type { BaseStorageOptions } from "../../shared/storageShared/types";

interface UseLocalStorageOptions<T> extends BaseStorageOptions<T> {
	crossInstanceSync?: boolean;
}

export type { UseLocalStorageOptions };
