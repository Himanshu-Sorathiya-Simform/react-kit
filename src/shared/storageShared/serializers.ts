import type { StorageSerializer } from "./types.ts";

/**
 * The default serializer used when no `serializer` option is passed to
 * `useLocalStorage`/`useSessionStorage`. Plain `JSON.stringify`/
 * `JSON.parse` — works for any JSON-safe value (objects, arrays, strings,
 * numbers, booleans, `null`), but not `Map`, `Set`, `Date`, `bigint`, or
 * `undefined` (see the other serializers below for those).
 */
const defaultSerializer: StorageSerializer<unknown> = {
	serialize: (value) => JSON.stringify(value),
	deserialize: (raw) => JSON.parse(raw) as unknown,
};

/**
 * Serializer for `Map` values. `JSON.stringify` can't handle `Map`
 * directly, so this round-trips it via an array of `[key, value]` entries.
 *
 * @typeParam K - The map's key type.
 * @typeParam V - The map's value type.
 *
 * @example
 * ```ts
 * useLocalStorage("tags", new Map<string, number>(), {
 *   serializer: mapSerializer<string, number>(),
 * });
 * ```
 */
function mapSerializer<K, V>(): StorageSerializer<Map<K, V>> {
	return {
		serialize: (map) => JSON.stringify(Array.from(map.entries())),
		deserialize: (raw) => new Map<K, V>(JSON.parse(raw) as [K, V][]),
	};
}

/**
 * Serializer for `Set` values, round-tripped via a plain array.
 *
 * @typeParam V - The set's value type.
 *
 * @example
 * ```ts
 * useLocalStorage("selectedIds", new Set<string>(), {
 *   serializer: setSerializer<string>(),
 * });
 * ```
 */
function setSerializer<V>(): StorageSerializer<Set<V>> {
	return {
		serialize: (set) => JSON.stringify(Array.from(set.values())),
		deserialize: (raw) => new Set<V>(JSON.parse(raw) as V[]),
	};
}

/**
 * Serializer for `Date` values, stored as an ISO 8601 string
 * (`Date.prototype.toISOString`).
 *
 * @throws During `deserialize`, if the stored string isn't a valid date —
 * caught by the hook, which falls back to `initialValue` and reports the
 * error via `onError`/the dev console warning.
 */
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

/**
 * Serializer for `bigint` values. `JSON.stringify` throws on `bigint`
 * values, so this stores them as a plain decimal string instead.
 *
 * @throws During `deserialize`, if the stored string can't be converted to
 * a `bigint` — caught by the hook, which falls back to `initialValue` and
 * reports the error via `onError`/the dev console warning.
 */
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
