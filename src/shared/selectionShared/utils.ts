import type { Path, PathValue } from "../stateShared/utils.ts";
import { getValue } from "../stateShared/utils.ts";
import type { SelectionId } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * All dot-notation paths of `T` whose resolved value is assignable to `TId`.
 *
 * @remarks
 * This is what makes `field` type-safe: a path pointing at a boolean, an
 * object, or a non-existent property simply isn't a member of this type, so
 * passing it is a compile-time error rather than a silent `undefined` at
 * runtime. Built on top of the `Path`/`PathValue` machinery already exported
 * by `getValue`'s module.
 *
 * @template T The item shape.
 * @template TId The id type the resolved value must be assignable to.
 */
type SelectionIdPath<T, TId extends SelectionId> = {
	[P in Path<T> & string]: PathValue<T, P> extends TId ? P : never;
}[Path<T> & string];

/**
 * Resolves a {@link SelectionId}-compatible id from either a raw id or a full item.
 *
 * @remarks
 * - If `item` is already a primitive (`string`/`number`), it is returned as-is
 *   and `field` is ignored — this lets every selection hook's mutators accept
 *   either a bare id or a full object interchangeably.
 * - If `item` is an object, `field` is used to extract the id via {@link getValue}.
 * - The internal `as TId` cast is safe *by construction*: `field`'s type is
 *   restricted to {@link SelectionIdPath}, which only admits paths whose
 *   resolved value already extends `TId`. TypeScript can't independently
 *   re-derive that guarantee through the conditional-type chain for an
 *   abstract `TId`, so a single, well-justified assertion lives here instead
 *   of being scattered across every call site.
 * - In development, logs an error (without throwing, so it never crashes a
 *   render) if resolution still produces `undefined`/`null` — this can only
 *   happen if the item's actual runtime shape doesn't match its declared
 *   type, since valid `T`/`field` combinations are enforced at compile time.
 *
 * @template T The item shape.
 * @template TId The id type to resolve.
 * @param item - A raw id, or a full item to extract an id from.
 * @param field - The dot-notation path to the id property. Ignored when `item` is already a primitive.
 * @returns The resolved id.
 */

function resolveSelectionId<T, TId extends SelectionId>(
	item: TId | T,
	field: SelectionIdPath<T, TId> | undefined,
): TId {
	const id = getValue(item, field) as TId;

	if (isDev && (id === undefined || id === null)) {
		console.warn(
			"[resolveSelectionId] Resolved id is",
			id,
			"— this usually means `field` does not point to a valid property on the "
				+ "item, or the item's runtime shape doesn't match its declared type.",
			{ item, field },
		);
		throw new Error(`[resolveSelectionId] Invalid id resolved: ${String(id)}`);
	}

	return id;
}

export { type SelectionIdPath, resolveSelectionId };
