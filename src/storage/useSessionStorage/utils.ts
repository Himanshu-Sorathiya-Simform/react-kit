import type {
	StorageCustomEventDetail,
	StorageSerializer,
} from "../../shared/storageShared/types";
import { SESSION_STORAGE_CUSTOM_EVENT } from "./constants";

function getSessionStorage(): Storage | null {
	if (typeof window === "undefined") return null;

	try {
		return window.sessionStorage;
	} catch {
		return null;
	}
}

function readFromStorage<T>(
	storage: Storage,
	key: string,
	initialValue: T | undefined,
	serializer: StorageSerializer<T>,
): { value: T | undefined; error: Error | null } {
	try {
		const raw = storage.getItem(key);

		if (raw === null) {
			return { value: initialValue, error: null };
		}

		return { value: serializer.deserialize(raw) as T, error: null };
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));

		return { value: initialValue, error };
	}
}

function dispatchSessionStorageEvent(
	key: string,
	value: string | null,
	instanceId: symbol,
): void {
	const detail: StorageCustomEventDetail = { value, instanceId };

	const event = new CustomEvent(`${SESSION_STORAGE_CUSTOM_EVENT}:${key}`, {
		detail,
	});

	window.dispatchEvent(event);
}

export { dispatchSessionStorageEvent, getSessionStorage, readFromStorage };
