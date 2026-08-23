import type { Path } from "../../shared/stateShared/utils.ts";

/** The id type `useVisibility` operates on by default - a raw `string` or `number`. */
type VisibilityId = string | number;

/**
 * Options for {@link useVisibility}, in either of its two modes - id-only
 * (`T` defaults to `TId`) or object mode (`T` is a distinct item shape,
 * `TId` its resolved id type).
 *
 * @remarks
 * The conditional shape is what makes `field` required in object mode and
 * disallowed in id-only mode, entirely at the type level - see
 * {@link useVisibility}'s remarks for why.
 *
 * @typeParam T - The item shape, or `TId` itself for id-only mode.
 * @typeParam TId - The id type.
 */
type UseVisibilityOptions<
	T = VisibilityId,
	TId extends VisibilityId = VisibilityId,
> =
	T extends TId ?
		{
			/** The full list of items whose visibility is being tracked - backs `visibleItems`/`hiddenItems`, and is the default target for `showAll` when it's called with no argument. */
			items?: readonly T[];
			/** Ids visible from the start - frozen at mount, see {@link useVisibility}'s remarks. */
			initialVisibleIds?: readonly TId[];
		}
	:	{
			/** The full list of items whose visibility is being tracked - backs `visibleItems`/`hiddenItems`, and is the default target for `showAll` when it's called with no argument. */
			items: readonly T[];
			/** A dot-path into `T`, used to resolve an item's id whenever a target is given as an item rather than a raw id. */
			field: Path<T> | (string & {});
			/** Ids visible from the start - frozen at mount, see {@link useVisibility}'s remarks. */
			initialVisibleIds?: readonly TId[];
		};

export type { UseVisibilityOptions, VisibilityId };
