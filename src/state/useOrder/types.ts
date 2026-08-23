import type { Path } from "../../shared/stateShared/utils.ts";

/**
 * The shape of every `target` parameter across {@link UseOrderReturn}'s
 * methods - a plain array index when no `field` is configured, or either an
 * index *or* a full item once one is (letting callers resolve an item's
 * current position for themselves instead of tracking indices by hand).
 *
 * @remarks
 * Deliberately gated behind `WithField` rather than always allowing `T`:
 * `useOrder`'s base (no-`field`) overload can be called with `T = number`
 * (ordering a plain array of numbers), where allowing an item argument too
 * would make a bare `number` genuinely ambiguous - "index `5`" or "the item
 * `5`"? Restricting item-based targeting to the `field`-configured overload
 * (see {@link UseOrderFieldOptions}) sidesteps that ambiguity entirely,
 * since `field` only makes sense for object items in the first place.
 *
 * @typeParam T - The item shape.
 * @typeParam WithField - Whether `field` was configured - see {@link UseOrderFieldOptions}.
 */
type OrderTarget<T, WithField extends boolean> =
	WithField extends true ? number | T : number;

/**
 * Options shared by both {@link useOrder} overloads, with or without `field`
 * configured.
 *
 * @typeParam T - The item shape.
 */
interface UseOrderBaseOptions<T> {
	/**
	 * Marks an item as un-movable and un-displaceable - see
	 * {@link UseOrderReturn} for exactly which operations this blocks, and
	 * how.
	 *
	 * @param item - The item to check.
	 * @param index - That item's current index.
	 * @returns `true` if `item` should be locked in place.
	 */
	isDisabled?: (item: T, index: number) => boolean;
}

/**
 * Options for the `field`-configured overload of {@link useOrder}, which
 * additionally accepts full items (not just indices) as move targets.
 *
 * @typeParam T - The item shape.
 */
interface UseOrderFieldOptions<T> extends UseOrderBaseOptions<T> {
	/**
	 * A dot-path into `T`, used to resolve an item's id whenever a target is
	 * given as an item rather than a raw index - see {@link OrderTarget}.
	 */
	field: Path<T> | (string & {});
}

export type { OrderTarget, UseOrderBaseOptions, UseOrderFieldOptions };
