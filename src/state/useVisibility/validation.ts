import { isStringOrNumber } from "../../shared/stateShared/coercion.ts";
import { getValue } from "../../shared/stateShared/utils.ts";
import type { VisibilityId } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * Checks that an `itemOrId` is safe to resolve, throwing in dev on failure
 * rather than letting a caller bug silently produce a broken visibility id.
 *
 * @remarks
 * Deliberately separate from {@link resolveVisibilityId}: this always runs
 * synchronously in the calling method's own body, before `setVisibleIdsSet`
 * is ever invoked - never inside the `setVisibleIdsSet` updater itself,
 * where a throw would be riskier (React may invoke an updater more than
 * once). `resolveVisibilityId`, by contrast, is safe to call from inside an
 * updater precisely because it never throws, only warns.
 *
 * @typeParam T - The item shape.
 * @param itemOrId - The value to validate - a raw id, or an item (only valid when `field` is configured).
 * @param field - The configured `field` path, or `undefined` if none.
 * @param fnName - Name of the calling method, used in warning/error messages.
 * @returns `true` if `itemOrId` is safe to resolve. `false` in production for input that would have thrown in dev.
 */
function validateVisibilityTarget<T>(
	itemOrId: VisibilityId | T,
	field: string | undefined,
	fnName: string,
): boolean {
	if (isStringOrNumber(itemOrId)) return true;

	if (!field) {
		if (isDev) {
			console.warn(
				`[useVisibility] ${fnName}: received an object item but no "field" option is configured to resolve its id. Every such item would collapse onto the same visibility id.`,
			);
			throw new Error(
				`[useVisibility] ${fnName}: received an object item but no "field" option is configured to resolve its id.`,
			);
		}

		return false;
	}

	return true;
}

/**
 * Resolves an `itemOrId` (raw id or item) to its concrete id.
 *
 * @remarks
 * Safe to call from inside a `setVisibleIdsSet` updater: never throws, only
 * warns in dev.
 *
 * @typeParam T - The item shape.
 * @typeParam TId - The id type.
 * @param itemOrId - A raw id, or an item to resolve via `field`.
 * @param field - The configured `field` path, or `undefined` if none.
 * @param fnName - Name of the calling method, used in warning messages.
 * @returns The resolved id, or `undefined` if `itemOrId` couldn't be resolved.
 */
function resolveVisibilityId<T, TId extends VisibilityId>(
	itemOrId: TId | T,
	field: string | undefined,
	fnName: string,
): TId | undefined {
	if (isStringOrNumber(itemOrId)) return itemOrId as TId;

	if (!field) return undefined;

	const resolved = getValue(itemOrId, field) as TId | undefined;

	if (resolved === undefined && isDev) {
		console.warn(
			`[useVisibility] ${fnName}: could not resolve an id from the given item using field "${field}".`,
		);
	}

	return resolved;
}

export { resolveVisibilityId, validateVisibilityTarget };
