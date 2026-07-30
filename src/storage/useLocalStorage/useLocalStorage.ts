import { useCallback, useEffect, useRef, useState } from "react";
import { useEventListener } from "../../events/index.ts";
import { defaultSerializer } from "../../shared/storageShared/serializers.ts";
import type {
	StorageCustomEventDetail,
	StorageSerializer,
} from "../../shared/storageShared/types.ts";
import { LOCAL_STORAGE_CUSTOM_EVENT } from "./constants.ts";
import type { UseLocalStorageOptions } from "./types.ts";
import {
	dispatchLocalStorageEvent,
	getLocalStorage,
	readFromStorage,
} from "./utils.ts";

interface UseLocalStorageReturn<T> {
	value: T | undefined;
	setValue: (valueOrUpdater: T | ((prev: T | undefined) => T)) => void;
	removeValue: () => void;
	isHydrated: boolean;
	error: Error | null;
}

function useLocalStorage<T = unknown>(
	key: string,
	initialValue?: T,
	options: UseLocalStorageOptions<T> = {},
): UseLocalStorageReturn<T> {
	const {
		serializer = defaultSerializer as StorageSerializer<T>,
		initializeWithValue = true,
		sameInstanceSync = true,
		crossInstanceSync = true,
	} = options;

	const [stableKey] = useState<string>(() => key);

	const stableKeyRef = useRef(stableKey);

	const keyChanged = key !== stableKey;

	const sameTabEventName = `${LOCAL_STORAGE_CUSTOM_EVENT}:${stableKey}`;

	const instanceIdRef = useRef<symbol>(Symbol());

	const serializerRef = useRef(serializer);

	useEffect(() => {
		serializerRef.current = serializer;
	}, [serializer]);

	const [value, setValueState] = useState<T | undefined>(() => {
		if (!initializeWithValue) return undefined;

		const storage = getLocalStorage();

		if (!storage) return initialValue;

		const { value: stored } = readFromStorage(
			storage,
			key,
			initialValue,
			serializer,
		);

		return stored;
	});

	const valueRef = useRef(value);

	useEffect(() => {
		valueRef.current = value;
	}, [value]);

	const [isHydrated, setIsHydrated] = useState<boolean>(
		initializeWithValue && typeof window !== "undefined",
	);

	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		if (!keyChanged) return;

		const keyChangeError = new Error(
			`[react-kit:use-local-storage] Changing the storage key at runtime is not supported. `
				+ `Still using original key: "${stableKeyRef.current}". Received new key: "${key}".`,
		);

		console.warn(keyChangeError.message);

		setError(keyChangeError);
	}, [key, keyChanged]);

	useEffect(() => {
		if (initializeWithValue) return;

		const storage = getLocalStorage();
		const { value: stored, error: readError } =
			storage !== null ?
				readFromStorage(
					storage,
					stableKeyRef.current,
					initialValue,
					serializerRef.current,
				)
			:	{ value: initialValue, error: null };

		if (readError) {
			console.warn(
				`[react-kit:use-local-storage] Failed to read key "${stableKeyRef.current}" from localStorage:`,
				readError.message,
			);

			setError(readError);
		}

		setValueState(stored);
		setIsHydrated(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initializeWithValue]);

	const setValue = useCallback(
		(valueOrUpdater: T | ((prev: T | undefined) => T)): void => {
			const storage = getLocalStorage();

			if (!storage) return;

			const prev = valueRef.current;
			const next =
				typeof valueOrUpdater === "function" ?
					(valueOrUpdater as (prev: T | undefined) => T)(prev)
				:	valueOrUpdater;

			try {
				const serialized = serializerRef.current.serialize(next);
				storage.setItem(stableKeyRef.current, serialized);

				setValueState(next);
				setError(null);

				if (sameInstanceSync) {
					dispatchLocalStorageEvent(
						stableKeyRef.current,
						serialized,
						instanceIdRef.current,
					);
				}
			} catch (err) {
				const writeError =
					err instanceof Error ? err : new Error(String(err));
				console.warn(
					`[react-kit:use-local-storage] Failed to write key "${stableKeyRef.current}" to localStorage:`,
					writeError.message,
				);

				setError(writeError);
			}
		},
		[sameInstanceSync],
	);

	const removeValue = useCallback((): void => {
		const storage = getLocalStorage();

		if (!storage) return;

		storage.removeItem(stableKeyRef.current);

		setValueState(initialValue);
		setError(null);

		if (sameInstanceSync) {
			dispatchLocalStorageEvent(
				stableKeyRef.current,
				null,
				instanceIdRef.current,
			);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sameInstanceSync]);

	useEventListener("storage", (event: StorageEvent) => {
		if (!crossInstanceSync) return;

		if (event.storageArea !== getLocalStorage()) return;
		if (event.key !== stableKeyRef.current) return;

		if (event.newValue === null) {
			setValueState(initialValue);
			setError(null);

			return;
		}

		try {
			const parsed = serializerRef.current.deserialize(event.newValue);

			setValueState(parsed as T);
			setError(null);
		} catch (err) {
			const syncError = err instanceof Error ? err : new Error(String(err));
			console.warn(
				`[react-kit:use-local-storage] Failed to deserialize cross-tab update for key "${stableKeyRef.current}":`,
				syncError.message,
			);

			setValueState(initialValue);
			setError(syncError);
		}
	});

	useEventListener(
		sameTabEventName,
		(event: Event) => {
			if (!sameInstanceSync) return;

			const customEvent = event as CustomEvent<StorageCustomEventDetail>;
			const detail = customEvent.detail;

			if (detail.instanceId === instanceIdRef.current) return;

			if (detail.value === null) {
				setValueState(initialValue);
				setError(null);

				return;
			}

			try {
				const parsed = serializerRef.current.deserialize(detail.value);
				setValueState(parsed as T);
				setError(null);
			} catch (err) {
				const syncError =
					err instanceof Error ? err : new Error(String(err));
				console.warn(
					`[react-kit:use-local-storage] Failed to deserialize same-tab update for key "${stableKeyRef.current}":`,
					syncError.message,
				);

				setValueState(initialValue);
				setError(syncError);
			}
		},
		{ target: typeof window === "undefined" ? null : window },
	);

	return { value, setValue, removeValue, isHydrated, error };
}

export { useLocalStorage, type UseLocalStorageReturn };
