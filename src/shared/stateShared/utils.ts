type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type PathImpl<K extends string | number, V> =
	V extends Primitive ? `${K}`
	: V extends readonly unknown[] ?
		| `${K}`
		| `${K}.${number}`
		| (V[number] extends Primitive ? never : `${K}.${number}.${Path<V[number]>}`)
	:	`${K}` | `${K}.${Path<V>}`;

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

function getValue<
	ReturnType = void,
	TObject = unknown,
	TPath extends Path<TObject> | (string & {}) | readonly (string | number)[] =
		Path<TObject>,
>(
	obj: TObject,
	path: TPath | undefined,
	defaultValue?: GetValueReturn<ReturnType, TObject, TPath>,
): GetValueReturn<ReturnType, TObject, TPath> {
	const isTraversable =
		(typeof obj === "object" || typeof obj === "function") && obj !== null;

	if (!isTraversable) {
		return obj as unknown as GetValueReturn<ReturnType, TObject, TPath>;
	}

	const keys: readonly (string | number)[] =
		typeof path === "string" ? path.split(".")
		: Array.isArray(path) ? path
		: [];

	if (keys.length === 0) {
		return (defaultValue ?? undefined) as unknown as GetValueReturn<
			ReturnType,
			TObject,
			TPath
		>;
	}

	const result = keys.reduce((current: unknown, key: string | number) => {
		const canTraverse =
			(typeof current === "object" || typeof current === "function")
			&& current !== null;

		if (!canTraverse) return undefined;

		return (current as Record<string | number, unknown>)[key];
	}, obj as unknown);

	return (result === undefined ?
		(defaultValue ?? undefined)
	:	result) as unknown as GetValueReturn<ReturnType, TObject, TPath>;
}

export { type Path, type PathValue, getValue };
