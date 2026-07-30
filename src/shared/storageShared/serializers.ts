import type { StorageSerializer } from "./types.ts";

const defaultSerializer: StorageSerializer<unknown> = {
	serialize: (value) => JSON.stringify(value),
	deserialize: (raw) => JSON.parse(raw) as unknown,
};

function mapSerializer<K, V>(): StorageSerializer<Map<K, V>> {
	return {
		serialize: (map) => JSON.stringify(Array.from(map.entries())),
		deserialize: (raw) => new Map<K, V>(JSON.parse(raw) as [K, V][]),
	};
}

function setSerializer<V>(): StorageSerializer<Set<V>> {
	return {
		serialize: (set) => JSON.stringify(Array.from(set.values())),
		deserialize: (raw) => new Set<V>(JSON.parse(raw) as V[]),
	};
}

const dateSerializer: StorageSerializer<Date> = {
	serialize: (date) => date.toISOString(),
	deserialize: (raw) => {
		const date = new Date(raw);

		if (isNaN(date.getTime())) {
			throw new Error(
				`[react-kit] dateSerializer: invalid date string "${raw}"`,
			);
		}

		return date;
	},
};

const bigIntSerializer: StorageSerializer<bigint> = {
	serialize: (value) => value.toString(),
	deserialize: (raw) => {
		try {
			return BigInt(raw);
		} catch {
			throw new Error(
				`[react-kit] bigIntSerializer: cannot convert "${raw}" to bigint`,
			);
		}
	},
};

export {
	bigIntSerializer,
	dateSerializer,
	defaultSerializer,
	mapSerializer,
	setSerializer,
};
