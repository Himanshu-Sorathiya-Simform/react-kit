import {
	isPositiveInteger,
	isStringOrNumber,
} from "../../shared/stateShared/coercion.ts";
import { getValue } from "../../shared/stateShared/utils.ts";
import type { PinId } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * Checks that an `itemOrId` is safe to resolve, throwing in dev on failure
 * rather than letting a caller bug silently produce a broken pin.
 *
 * @remarks
 * Deliberately separate from {@link resolvePinId}: this always runs
 * synchronously in the calling method's own body, before `setPinnedIdsSet`
 * is ever invoked - never inside the `setPinnedIdsSet` updater itself,
 * where a throw would be riskier (React may invoke an updater more than
 * once). `resolvePinId`, by contrast, is safe to call from inside an
 * updater precisely because it never throws, only warns.
 *
 * @typeParam T - The item shape.
 * @param itemOrId - The value to validate - a raw id, or an item (only valid when `field` is configured).
 * @param field - The configured `field` path, or `undefined` if none.
 * @param fnName - Name of the calling method, used in warning/error messages.
 * @returns `true` if `itemOrId` is safe to resolve. `false` in production for input that would have thrown in dev.
 */
function validatePinTarget<T>(
	itemOrId: PinId | T,
	field: string | undefined,
	fnName: string,
): boolean {
	if (isStringOrNumber(itemOrId)) return true;

	if (!field) {
		if (isDev) {
			console.warn(
				`[usePin] ${fnName}: received an object item but no "field" option is configured to resolve its id. Every such item would collapse onto the same pinned id.`,
			);
			throw new Error(
				`[usePin] ${fnName}: received an object item but no "field" option is configured to resolve its id.`,
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
 * Safe to call from inside a `setPinnedIdsSet` updater: never throws, only
 * warns in dev.
 *
 * @typeParam T - The item shape.
 * @typeParam TId - The id type.
 * @param itemOrId - A raw id, or an item to resolve via `field`.
 * @param field - The configured `field` path, or `undefined` if none.
 * @param fnName - Name of the calling method, used in warning messages.
 * @returns The resolved id, or `undefined` if `itemOrId` couldn't be resolved.
 */
function resolvePinId<T, TId extends PinId>(
	itemOrId: TId | T,
	field: string | undefined,
	fnName: string,
): TId | undefined {
	if (isStringOrNumber(itemOrId)) return itemOrId as TId;

	if (!field) return undefined;

	const resolved = getValue(itemOrId, field) as TId | undefined;

	if (resolved === undefined && isDev) {
		console.warn(
			`[usePin] ${fnName}: could not resolve an id from the given item using field "${field}".`,
		);
	}

	return resolved;
}

/**
 * Validates a `maxPins` value, throwing in dev on failure rather than
 * silently accepting a limit that could never be honored.
 *
 * @remarks
 * Used both at mount (for the initial `maxPins` option) and by
 * `changeMaxPins` - the same rule applies either way, so both entry points
 * share this one implementation.
 *
 * @param maxPins - The value to validate, or `undefined` for "unlimited."
 * @param fnName - Name of the calling method, used in warning/error messages.
 * @returns `maxPins` itself if valid, `Number.MAX_SAFE_INTEGER` for `undefined` or (in production) invalid input.
 */
function resolveMaxPins(maxPins: number | undefined, fnName: string): number {
	if (maxPins === undefined) return Number.MAX_SAFE_INTEGER;

	if (isPositiveInteger(maxPins)) return maxPins;

	if (isDev) {
		console.warn(
			`[usePin] ${fnName}: maxPins must be a positive integer, received: ${maxPins}.`,
		);
		throw new Error(
			`[usePin] ${fnName}: maxPins must be a positive integer, received: ${maxPins}.`,
		);
	}

	return Number.MAX_SAFE_INTEGER;
}

/**
 * Dev-only warning for a pin attempt rejected because `maxPins` was already
 * reached.
 *
 * @param fnName - Name of the calling method, used in the warning message.
 */
function warnPinLimitReached(fnName: string): void {
	if (isDev) {
		console.warn(
			`[usePin] ${fnName}: pin limit reached; call ignored. Check "canPin" before calling, or raise "maxPins".`,
		);
	}
}

/**
 * Dev-only warning for a batch of ids being truncated to fit `maxPins`.
 *
 * @param fnName - Name of the calling method, used in the warning message.
 * @param attempted - How many ids were attempted.
 * @param limit - The current `maxPins` value.
 */
function warnPinsTruncated(fnName: string, attempted: number, limit: number): void {
	if (isDev) {
		console.warn(
			`[usePin] ${fnName}: ${attempted} pinned ids exceeds maxPins (${limit}); truncating to the first ${limit}.`,
		);
	}
}

export {
	resolveMaxPins,
	resolvePinId,
	validatePinTarget,
	warnPinLimitReached,
	warnPinsTruncated,
};
