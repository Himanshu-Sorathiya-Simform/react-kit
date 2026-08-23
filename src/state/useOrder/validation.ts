import { isInteger } from "../../shared/stateShared/coercion.ts";
import { getValue } from "../../shared/stateShared/utils.ts";
import { normalizeIndex } from "./utils.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * Checks that a `target` is well-formed enough to attempt resolving,
 * throwing in dev on failure rather than letting a caller bug silently
 * no-op.
 *
 * @remarks
 * Deliberately separate from {@link resolveTarget}: this always runs
 * synchronously in the calling method's own body, before `setOrderedItems`
 * is ever invoked - never inside the `setOrderedItems` updater itself,
 * where a throw would be riskier (React may invoke an updater more than
 * once). `resolveTarget`, by contrast, is safe to call from inside an
 * updater precisely because it never throws, only warns.
 *
 * @typeParam T - The item shape.
 * @param target - The value to validate - a raw index, or an item (only valid when `field` is configured).
 * @param field - The configured `field` path, or `undefined` if none.
 * @param fnName - Name of the calling method, used in warning/error messages.
 * @returns `true` if `target` is safe to resolve. `false` in production for input that would have thrown in dev.
 */
function validateTargetInput<T>(
	target: number | T,
	field: string | undefined,
	fnName: string,
): boolean {
	if (typeof target === "number") {
		if (isInteger(target)) return true;

		if (isDev) {
			console.warn(
				`[useOrder] ${fnName}: index must be an integer, received: ${target}.`,
			);
			throw new Error(
				`[useOrder] ${fnName}: index must be an integer, received: ${target}.`,
			);
		}

		return false;
	}

	if (!field) {
		if (isDev) {
			console.warn(
				`[useOrder] ${fnName}: received an item instead of a numeric index, but no "field" option is configured to resolve it.`,
			);
			throw new Error(
				`[useOrder] ${fnName}: received an item instead of a numeric index, but no "field" option is configured to resolve it.`,
			);
		}

		return false;
	}

	return true;
}

/**
 * Resolves a `target` (raw index or item) to a concrete, in-bounds index
 * within `items` - the single implementation shared by every read and write
 * operation in {@link useOrder}.
 *
 * @remarks
 * Safe to call from inside a `setOrderedItems` updater: never throws, only
 * warns in dev. Always resolves against the `items` array it's explicitly
 * given, never any outer closed-over state - callers that need read-only,
 * O(1) resolution (the `canMove*` predicates) may pass `idToIndexMap` to
 * skip the linear scan; the mutators deliberately don't, since that map is
 * only ever as fresh as the last committed render, and resolving against it
 * from inside an updater could act on a stale index if multiple mutations
 * are queued in the same tick. See the comment beside `idToIndexMap`'s
 * `useMemo` in `useOrder.ts`.
 *
 * @typeParam T - The item shape.
 * @param target - A raw index, or an item to resolve via `field`.
 * @param items - The array to resolve `target` against.
 * @param field - The configured `field` path, or `undefined` if none.
 * @param fnName - Name of the calling method, used in warning messages.
 * @param warnOnUnresolved - Whether an unresolved target should warn in dev - `false` for the `canMove*` predicates, where "can't resolve" is just a normal `false` answer, not a caller bug.
 * @param idToIndexMap - Optional precomputed id→index map for O(1) item-based resolution - see remarks.
 * @returns The resolved, in-bounds index, or `undefined` if `target` couldn't be resolved.
 */
function resolveTarget<T>(
	target: number | T,
	items: readonly T[],
	field: string | undefined,
	fnName: string,
	warnOnUnresolved: boolean,
	idToIndexMap?: ReadonlyMap<unknown, number>,
): number | undefined {
	const length = items.length;

	if (typeof target === "number") {
		const normalized = normalizeIndex(target, length);

		if (normalized < 0 || normalized >= length) {
			if (isDev && warnOnUnresolved) {
				console.warn(
					`[useOrder] ${fnName}: index ${target} is out of bounds for an array of length ${length}. Call ignored.`,
				);
			}

			return undefined;
		}

		return normalized;
	}

	const targetId = getValue(target, field);

	if (targetId === undefined) {
		if (isDev && warnOnUnresolved) {
			console.warn(
				`[useOrder] ${fnName}: could not resolve an id from the given item using field "${field}". Call ignored.`,
			);
		}

		return undefined;
	}

	if (idToIndexMap) {
		const index = idToIndexMap.get(targetId);

		if (index === undefined && isDev && warnOnUnresolved) {
			console.warn(
				`[useOrder] ${fnName}: no item with a matching id was found in orderedItems. Call ignored.`,
			);
		}

		return index;
	}

	const index = items.findIndex((item) => getValue(item, field) === targetId);

	if (index === -1) {
		if (isDev && warnOnUnresolved) {
			console.warn(
				`[useOrder] ${fnName}: no item with a matching id was found in orderedItems. Call ignored.`,
			);
		}

		return undefined;
	}

	return index;
}

export { resolveTarget, validateTargetInput };
