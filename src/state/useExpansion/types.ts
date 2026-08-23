import type { Path } from "../../shared/stateShared/utils.ts";

/** The id type `useExpansion` operates on by default - a raw `string` or `number`. */
type ExpansionId = string | number;

/**
 * Options for {@link useExpansion}, in either of its two modes - id-only
 * (`T` defaults to `TId`) or object mode (`T` is a distinct item shape,
 * `TId` its resolved id type).
 *
 * @remarks
 * The conditional shape is what makes `field` required in object mode and
 * disallowed in id-only mode, entirely at the type level - see
 * {@link useExpansion}'s remarks for why.
 *
 * @typeParam T - The item shape, or `TId` itself for id-only mode.
 * @typeParam TId - The id type.
 */
type UseExpansionOptions<T = ExpansionId, TId extends ExpansionId = ExpansionId> =
	T extends TId ?
		{
			/** The full list of expandable items - backs `expandedItems`/`collapsedItems`, and is the default target for `expandAll` when it's called with no argument. */
			items?: readonly T[];
			/** Ids expanded from the start - frozen at mount, see {@link useExpansion}'s remarks. */
			initialExpandedIds?: readonly TId[];
			/** Whether more than one item can be expanded at once. `false` (the default) gives accordion-style behavior, where expanding one item collapses whatever was previously expanded. */
			multiple?: boolean;
			/**
			 * In single (`multiple: false`) mode, whether the one expanded item
			 * can be collapsed back down to nothing.
			 *
			 * @remarks
			 * Ignored when `multiple` is `true` - "can everything be collapsed"
			 * isn't a meaningful constraint once more than one item can be open
			 * at a time. Mirrors Radix UI Accordion's `collapsible` prop, though
			 * the default here is the opposite of Radix's: `true`, matching what
			 * this hook already did before `collapsible` existed, so leaving it
			 * unset doesn't change any existing behavior.
			 *
			 * @defaultValue `true`
			 */
			collapsible?: boolean;
		}
	:	{
			/** The full list of expandable items - backs `expandedItems`/`collapsedItems`, and is the default target for `expandAll` when it's called with no argument. */
			items: readonly T[];
			/** A dot-path into `T`, used to resolve an item's id whenever a target is given as an item rather than a raw id. */
			field: Path<T> | (string & {});
			/** Ids expanded from the start - frozen at mount, see {@link useExpansion}'s remarks. */
			initialExpandedIds?: readonly TId[];
			/** Whether more than one item can be expanded at once. `false` (the default) gives accordion-style behavior, where expanding one item collapses whatever was previously expanded. */
			multiple?: boolean;
			/**
			 * In single (`multiple: false`) mode, whether the one expanded item
			 * can be collapsed back down to nothing.
			 *
			 * @remarks
			 * Ignored when `multiple` is `true` - "can everything be collapsed"
			 * isn't a meaningful constraint once more than one item can be open
			 * at a time. Mirrors Radix UI Accordion's `collapsible` prop, though
			 * the default here is the opposite of Radix's: `true`, matching what
			 * this hook already did before `collapsible` existed, so leaving it
			 * unset doesn't change any existing behavior.
			 *
			 * @defaultValue `true`
			 */
			collapsible?: boolean;
		};

export type { ExpansionId, UseExpansionOptions };
