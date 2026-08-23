import type { Path } from "../../shared/stateShared/utils.ts";

/** The id type `usePin` operates on by default - a raw `string` or `number`. */
type PinId = string | number;

/**
 * Options for {@link usePin}, in either of its two modes - id-only (`T`
 * defaults to `TId`) or object mode (`T` is a distinct item shape, `TId`
 * its resolved id type).
 *
 * @remarks
 * The conditional shape is what makes `field` required in object mode and
 * disallowed in id-only mode, entirely at the type level - see
 * {@link usePin}'s remarks for why.
 *
 * @typeParam T - The item shape, or `TId` itself for id-only mode.
 * @typeParam TId - The id type.
 */
type UsePinOptions<T = PinId, TId extends PinId = PinId> =
	T extends TId ?
		{
			/** The full list of pinnable items - backs `pinnedItems`/`unpinnedItems`, and is the default target for `pinAll` when it's called with no argument. */
			items?: readonly T[];
			/** Ids pinned from the start - frozen at mount, see {@link usePin}'s remarks. */
			initialPinnedIds?: readonly TId[];
			/** The maximum number of ids that can be pinned at once. `undefined` means unlimited. */
			maxPins?: number;
		}
	:	{
			/** The full list of pinnable items - backs `pinnedItems`/`unpinnedItems`, and is the default target for `pinAll` when it's called with no argument. */
			items: readonly T[];
			/** A dot-path into `T`, used to resolve an item's id whenever a target is given as an item rather than a raw id. */
			field: Path<T> | (string & {});
			/** Ids pinned from the start - frozen at mount, see {@link usePin}'s remarks. */
			initialPinnedIds?: readonly TId[];
			/** The maximum number of ids that can be pinned at once. `undefined` means unlimited. */
			maxPins?: number;
		};

export type { PinId, UsePinOptions };
