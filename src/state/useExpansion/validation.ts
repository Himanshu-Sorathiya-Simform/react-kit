import { isStringOrNumber } from "../../shared/stateShared/coercion.ts";
import { getValue } from "../../shared/stateShared/utils.ts";
import type { ExpansionId } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * Checks that an `itemOrId` is safe to resolve, throwing in dev on failure
 * rather than letting a caller bug silently produce a broken expanded id.
 *
 * @remarks
 * Deliberately separate from {@link resolveExpansionId}: this always runs
 * synchronously in the calling method's own body, before `setExpandedIdsSet`
 * is ever invoked - never inside the `setExpandedIdsSet` updater itself,
 * where a throw would be riskier (React may invoke an updater more than
 * once). `resolveExpansionId`, by contrast, is safe to call from inside an
 * updater precisely because it never throws, only warns.
 *
 * @typeParam T - The item shape.
 * @param itemOrId - The value to validate - a raw id, or an item (only valid when `field` is configured).
 * @param field - The configured `field` path, or `undefined` if none.
 * @param fnName - Name of the calling method, used in warning/error messages.
 * @returns `true` if `itemOrId` is safe to resolve. `false` in production for input that would have thrown in dev.
 */
function validateExpansionTarget<T>(
	itemOrId: ExpansionId | T,
	field: string | undefined,
	fnName: string,
): boolean {
	if (isStringOrNumber(itemOrId)) return true;

	if (!field) {
		if (isDev) {
			console.warn(
				`[useExpansion] ${fnName}: received an object item but no "field" option is configured to resolve its id. Every such item would collapse onto the same expanded id.`,
			);
			throw new Error(
				`[useExpansion] ${fnName}: received an object item but no "field" option is configured to resolve its id.`,
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
 * Safe to call from inside a `setExpandedIdsSet` updater: never throws,
 * only warns in dev.
 *
 * @typeParam T - The item shape.
 * @typeParam TId - The id type.
 * @param itemOrId - A raw id, or an item to resolve via `field`.
 * @param field - The configured `field` path, or `undefined` if none.
 * @param fnName - Name of the calling method, used in warning messages.
 * @returns The resolved id, or `undefined` if `itemOrId` couldn't be resolved.
 */
function resolveExpansionId<T, TId extends ExpansionId>(
	itemOrId: TId | T,
	field: string | undefined,
	fnName: string,
): TId | undefined {
	if (isStringOrNumber(itemOrId)) return itemOrId as TId;

	if (!field) return undefined;

	const resolved = getValue(itemOrId, field) as TId | undefined;

	if (resolved === undefined && isDev) {
		console.warn(
			`[useExpansion] ${fnName}: could not resolve an id from the given item using field "${field}".`,
		);
	}

	return resolved;
}

/**
 * Dev-only warning for more than one id being given while `multiple` is
 * `false` - only the first is kept.
 *
 * @remarks
 * Shared by every entry point that can introduce more than one id at once
 * while in single mode: the initial `useState`, `resetExpansion`, and
 * `replaceExpansion`. `expand`/`toggleExpansion` don't need this - they
 * already enforce single mode per-call by construction, never producing an
 * over-count set in the first place.
 *
 * @param fnName - Name of the calling method, used in the warning message.
 * @param attempted - How many ids were given.
 */
function warnSingleModeTruncated(fnName: string, attempted: number): void {
	if (isDev) {
		console.warn(
			`[useExpansion] ${fnName}: ${attempted} expanded ids were given but "multiple" is false; keeping only the first.`,
		);
	}
}

/**
 * Dev-only warning for an attempt to collapse the one expanded item in
 * single mode while `collapsible` is `false`.
 *
 * @param fnName - Name of the calling method, used in the warning message.
 */
function warnCollapsibleBlocked(fnName: string): void {
	if (isDev) {
		console.warn(
			`[useExpansion] ${fnName}: the only expanded item can't be collapsed because "collapsible" is false.`,
		);
	}
}

/** Dev-only warning for calling `expandAll` while `multiple` is `false`, where it has no effect. */
function warnExpandAllSingleMode(): void {
	if (isDev) {
		console.warn(
			`[useExpansion] expandAll: has no effect because "multiple" is false.`,
		);
	}
}

export {
	resolveExpansionId,
	validateExpansionTarget,
	warnCollapsibleBlocked,
	warnExpandAllSingleMode,
	warnSingleModeTruncated,
};
