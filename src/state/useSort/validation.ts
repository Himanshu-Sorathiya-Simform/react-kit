import type { SortConfig, SortConfigUpdate, SortState } from "./types";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * Dev-only: warns if two or more sort keys share the same `id`, since a
 * duplicate id makes every id-based lookup (`getSort`, `getSortDirection`,
 * `getNextSortingOrder`, `getSortIndex`, `updateSortConfig`) ambiguous
 * about which one it means. No-op in production.
 */
function warnIfDuplicateIds(sorts: SortState, source: string): void {
	if (!isDev) return;

	const seen = new Set<string>();
	const duplicates = new Set<string>();

	for (const s of sorts) {
		if (seen.has(s.id)) duplicates.add(s.id);
		seen.add(s.id);
	}

	if (duplicates.size > 0) {
		console.warn(
			`[useSort] ${source} contains duplicate sort ids: ${[...duplicates].join(", ")}. Lookups by id (getSort, getSortDirection, getNextSortingOrder, getSortIndex, updateSortConfig) will only ever affect the first match.`,
		);
	}
}

/**
 * Structural check that a {@link SortConfig}'s type-specific extra fields
 * (`dateGranularity`, `caseSensitive`, `compare`) are well-formed for its
 * own `type`.
 *
 * @remarks
 * Deliberately shallow - it doesn't validate that `compare` behaves
 * sensibly, only that it's a function. This exists specifically to catch
 * what {@link SortConfigUpdate}'s type can't: a merged partial update that
 * lands on a structurally invalid combination (e.g. a `custom` sort losing
 * its `compare` function via an update that didn't include one).
 */
function isSortConfigShapeValid(config: SortConfig): boolean {
	if (config.type === "custom") return typeof config.compare === "function";

	if (config.type === "date") {
		return (
			config.dateGranularity === undefined
			|| config.dateGranularity === "day"
			|| config.dateGranularity === "instant"
		);
	}

	if (config.type === "alphabetical" || config.type === "alphanumeric") {
		return (
			config.caseSensitive === undefined
			|| typeof config.caseSensitive === "boolean"
		);
	}

	return true;
}

/**
 * Shared implementation behind `updateSortConfig`: merges `partialConfig`
 * into the existing sort matching `id`, validates the merged result via
 * {@link isSortConfigShapeValid}, and only then commits it.
 *
 * @remarks
 * Same dev/prod split as this library's other update-by-id functions: an
 * unknown `id`, or an update that would produce a structurally invalid
 * config, throws immediately in development but is silently ignored
 * (returning `prev` unchanged) in production.
 */
function applySortUpdate(
	prev: SortState,
	id: string,
	partialConfig: SortConfigUpdate,
	source: string,
): SortState {
	const index = prev.findIndex((s) => s.id === id);
	const current = prev[index];

	if (index === -1 || !current) {
		if (isDev) {
			console.warn(`[useSort] ${source}: no sort found with id "${id}".`);
			throw new Error(`[useSort] ${source}: no sort found with id "${id}".`);
		}

		return prev;
	}

	const merged = { ...current, ...partialConfig } as SortConfig;

	if (!isSortConfigShapeValid(merged)) {
		if (isDev) {
			console.warn(
				`[useSort] ${source}: update to sort "${id}" would produce an invalid config for type "${merged.type}".`,
				{ attempted: partialConfig, current },
			);

			throw new Error(
				`[useSort] ${source}: update to sort "${id}" would produce an invalid config for type "${merged.type}".`,
			);
		}

		return prev;
	}

	const next = [...prev];
	next[index] = merged;
	return next;
}

export { applySortUpdate, isSortConfigShapeValid, warnIfDuplicateIds };
