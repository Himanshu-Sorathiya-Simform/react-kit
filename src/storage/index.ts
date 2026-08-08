export {
	type UseLocalStorageReturn,
	useLocalStorage,
} from "./useLocalStorage/useLocalStorage";
export {
	type UseSessionStorageReturn,
	useSessionStorage,
} from "./useSessionStorage/useSessionStorage";

export {
	bigIntSerializer,
	dateSerializer,
	defaultSerializer,
	mapSerializer,
	setSerializer,
} from "../shared/storageShared/serializers";

export type {
	BaseStorageOptions,
	StorageCustomEventDetail,
	StorageSerializer,
} from "../shared/storageShared/types";
export type { UseLocalStorageOptions } from "./useLocalStorage/types";
export type { UseSessionStorageOptions } from "./useSessionStorage/types";
