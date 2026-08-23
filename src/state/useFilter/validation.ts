import { isDateLike } from "../../shared/stateShared/coercion.ts";
import type { FilterConfig, FilterConfigUpdate, FilterState } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * Dev-only: warns if two or more filters share the same `id`, since a
 * duplicate id makes every id-based lookup (`getFilter`, `getFilterValue`,
 * `isFilterActive`, `updateFilterConfig`, `updateFilterValue`) ambiguous
 * about which one it means. No-op in production.
 */
function warnIfDuplicateIds<T>(filters: FilterState<T>, source: string): void {
	if (!isDev) return;

	const seen = new Set<string>();
	const duplicates = new Set<string>();

	for (const f of filters) {
		if (seen.has(f.id)) duplicates.add(f.id);
		seen.add(f.id);
	}

	if (duplicates.size > 0) {
		console.warn(
			`[useFilter] ${source} contains duplicate filter ids: ${[...duplicates].join(", ")}. Lookups by id (getFilter, getFilterValue, isFilterActive, updateFilterConfig, updateFilterValue) will only ever affect the first match.`,
		);
	}
}

/**
 * Structural check that `value` is shaped correctly for the given
 * `type`/`operator` pair.
 *
 * @remarks
 * Deliberately shallow - it doesn't check whether a date string actually
 * parses, or whether a number is finite, since {@link FILTER_STRATEGIES}
 * already owns that validation at match time. This exists only to stop
 * `updateFilterConfig`/`updateFilterValue` from writing a structurally
 * mismatched value into state (e.g. an object into a `text` filter, a bare
 * number into a `between` filter) - something TypeScript alone can't catch
 * for a *partial* update (see {@link FilterConfigUpdate}'s `@remarks`), so
 * it's enforced at runtime here instead.
 */
function isValueShapeValid(
	type: FilterConfig<unknown>["type"],
	operator: string,
	value: unknown,
): boolean {
	switch (type) {
		case "text":
			return typeof value === "string";

		case "number": {
			if (operator === "between") {
				return (
					typeof value === "object"
					&& value !== null
					&& !Array.isArray(value)
					&& typeof (value as { min?: unknown }).min === "number"
					&& typeof (value as { max?: unknown }).max === "number"
				);
			}

			return typeof value === "number";
		}

		case "boolean":
			return typeof value === "boolean";

		case "date": {
			if (operator === "between") {
				return (
					typeof value === "object"
					&& value !== null
					&& !Array.isArray(value)
					&& isDateLike((value as { min?: unknown }).min)
					&& isDateLike((value as { max?: unknown }).max)
				);
			}

			return isDateLike(value);
		}

		case "select": {
			if (operator === "in" || operator === "notIn") {
				return (
					Array.isArray(value)
					&& value.every(
						(v) => typeof v === "string" || typeof v === "number",
					)
				);
			}

			return typeof value === "string" || typeof value === "number";
		}

		case "multiselect":
			return Array.isArray(value);

		case "custom":
			return true;

		default:
			return false;
	}
}

/**
 * Shared implementation behind `updateFilterConfig`/`updateFilterValue`:
 * merges `partialConfig` into the existing filter matching `id`, validates
 * the merged result via {@link isValueShapeValid}, and only then commits
 * it.
 *
 * @remarks
 * Same dev/prod split as this library's other update-by-id functions: an
 * unknown `id`, or an update that would produce a structurally invalid
 * filter, throws immediately in development but is silently ignored
 * (returning `prev` unchanged) in production.
 */
function applyFilterUpdate<T>(
	prev: FilterState<T>,
	id: string,
	partialConfig: FilterConfigUpdate<T>,
	source: string,
): FilterState<T> {
	const index = prev.findIndex((f) => f.id === id);
	const current = prev[index];

	if (index === -1 || !current) {
		if (isDev) {
			console.warn(`[useFilter] ${source}: no filter found with id "${id}".`);

			throw new Error(
				`[useFilter] ${source}: no filter found with id "${id}".`,
			);
		}

		return prev;
	}

	const merged = { ...current, ...partialConfig } as FilterConfig<T>;

	if (!isValueShapeValid(merged.type, merged.operator, merged.value)) {
		if (isDev) {
			console.warn(
				`[useFilter] ${source}: update to filter "${id}" would produce a value incompatible with type "${merged.type}" and operator "${merged.operator}". Update was ignored to avoid corrupting filter state.`,
				{ attempted: partialConfig, current },
			);

			throw new Error(
				`[useFilter] ${source}: update to filter "${id}" would produce a value incompatible with type "${merged.type}" and operator "${merged.operator}". Update was ignored to avoid corrupting filter state.`,
			);
		}

		return prev;
	}

	const next = [...prev];
	next[index] = merged;
	return next;
}

export { applyFilterUpdate, isValueShapeValid, warnIfDuplicateIds };
