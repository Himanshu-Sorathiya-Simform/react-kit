type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type PathImpl<K extends string | number, V> =
	V extends Primitive ? `${K}` : `${K}` | `${K}.${Path<V>}`;

type Path<T> =
	T extends object ?
		{
			[K in keyof T & (string | number)]: PathImpl<K, T[K]>;
		}[keyof T & (string | number)]
	:	never;

type PathValue<T, P extends string> =
	P extends `${infer K}.${infer Rest}` ?
		K extends keyof T ?
			PathValue<T[K], Rest>
		:	unknown
	: P extends keyof T ? T[P]
	: unknown;

type GetValueReturn<ReturnType, TObject, TPath> =
	[ReturnType] extends [void] ?
		TPath extends string ?
			PathValue<TObject, TPath>
		:	unknown
	:	ReturnType;

/**
 * Safely extracts a deeply nested value from an object using a dot-notation path or array of keys.
 *
 * @template ReturnType Explicitly override the return type if passing a dynamic path.
 * @template TObject The target object type.
 * @template TPath The string path or array path.
 */
function getValue<
	ReturnType = void,
	TObject extends Record<string, unknown> = Record<string, unknown>,
	TPath extends Path<TObject> | (string & {}) | readonly string[] = Path<TObject>,
>(
	obj: TObject,
	path: TPath | undefined,
): GetValueReturn<ReturnType, TObject, TPath> {
	if (typeof obj !== "object" || obj === null) {
		return obj as unknown as GetValueReturn<ReturnType, TObject, TPath>;
	}

	if (!path) {
		return undefined as unknown as GetValueReturn<ReturnType, TObject, TPath>;
	}

	const keys: readonly string[] =
		typeof path === "string" ? path.split(".") : (path as readonly string[]);

	return keys.reduce((current: unknown, key: string) => {
		if (typeof current !== "object" || current === null) return undefined;

		return (current as Record<string, unknown>)[key];
	}, obj as unknown) as GetValueReturn<ReturnType, TObject, TPath>;
}

export { getValue };
