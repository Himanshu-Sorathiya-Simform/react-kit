import type { GroupByLevel, NormalizedGroupByLevel } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/** Expands the {@link GroupByLevel} string shorthand into its full `{ type: "field", field }` form; passes an already-object level through unchanged. */
function normalizeLevel<T>(level: GroupByLevel<T>): NormalizedGroupByLevel<T> {
	return typeof level === "string" ? { type: "field", field: level } : level;
}

/** Normalizes a single level, an array of levels, or `undefined` into the flat {@link NormalizedGroupByLevel} array shape {@link useGrouping} stores internally. */
function normalizeGroupByInput<T>(
	input: GroupByLevel<T> | GroupByLevel<T>[] | undefined,
): NormalizedGroupByLevel<T>[] {
	if (input === undefined) return [];

	const list = Array.isArray(input) ? input : [input];

	return list.map((level) => normalizeLevel(level));
}

/** Defensive against genuinely untyped JS callers passing garbage (null,
 * a number, etc.) as a level -- guards before touching `.type` so this
 * never throws on bad input, only reports it as invalid. */
function isLevelShapeValid<T>(level: NormalizedGroupByLevel<T>): boolean {
	if (typeof level !== "object" || level === null) return false;

	if (level.type === "field") {
		return typeof level.field === "string" && level.field.length > 0;
	}

	if (level.type === "date") {
		return (
			typeof level.field === "string"
			&& level.field.length > 0
			&& (level.bucket === undefined
				|| level.bucket === "day"
				|| level.bucket === "month"
				|| level.bucket === "year")
		);
	}

	if (level.type === "custom") {
		return (
			typeof level.getKey === "function"
			&& (level.id === undefined || typeof level.id === "string")
		);
	}

	return false;
}

/**
 * Dev-only: warns if two or more `custom` levels share the same `id`, since
 * a dev warning that references a level by id would then be ambiguous about
 * which one it means. No-op in production, and no-op if no `custom` level
 * sets an `id` at all.
 */
function warnIfDuplicateCustomIds<T>(levels: NormalizedGroupByLevel<T>[]): void {
	if (!isDev) return;

	const seen = new Set<string>();
	const duplicates = new Set<string>();

	for (const level of levels) {
		if (level.type !== "custom" || !level.id) continue;
		if (seen.has(level.id)) duplicates.add(level.id);
		seen.add(level.id);
	}

	if (duplicates.size > 0) {
		console.warn(
			`[useGrouping] duplicate custom group level ids: ${[...duplicates].join(", ")}. Dev warnings referencing these ids may be ambiguous about which level they mean.`,
		);
	}
}

export {
	isLevelShapeValid,
	normalizeGroupByInput,
	normalizeLevel,
	warnIfDuplicateCustomIds,
};
