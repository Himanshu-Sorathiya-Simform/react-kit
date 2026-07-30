interface StorageSerializer<T> {
	serialize: (value: T) => string;
	deserialize: (raw: string) => T;
}

interface BaseStorageOptions<T> {
	serializer?: StorageSerializer<T>;
	initializeWithValue?: boolean;
	sameInstanceSync?: boolean;
}

interface StorageCustomEventDetail {
	value: string | null;
	instanceId: symbol;
}

export type { BaseStorageOptions, StorageCustomEventDetail, StorageSerializer };
