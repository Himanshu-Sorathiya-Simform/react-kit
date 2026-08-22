import type { SelectionId } from "../../shared/selectionShared/types.ts";
import type { SelectionIdPath } from "../../shared/selectionShared/utils.ts";

/**
 * The options every {@link useMultipleSelection} call accepts regardless of
 * whether `T` is a raw id type or an object type.
 *
 * @typeParam T - The item shape (or `TId` itself, for id-only mode).
 * @typeParam TId - The id type used internally for `Set`/comparison purposes.
 */
interface UseMultipleSelectionBaseOptions<T, TId extends SelectionId> {
	/**
	 * The items this selection is over. Determines `selectedItems`, and is
	 * what `selectAll`/`toggleAll`/`invertSelection` operate against.
	 *
	 * @remarks
	 * Pass a stable/memoized array. An inline `items={data.filter(...)}` gets
	 * a new reference every render, which cascades into every memoized value
	 * derived from `items` recomputing every render too — this hook can't
	 * cheaply detect "same contents, different reference" for you.
	 */
	items?: readonly T[];

	/**
	 * The ids selected on mount, and what {@link UseMultipleSelectionReturn.reset}
	 * returns the selection to.
	 *
	 * @remarks
	 * Only the value present on the **first render** seeds state (standard
	 * `useState` initializer semantics). `reset()` always reads the **latest**
	 * `defaultSelectedIds` at call time, so if this changes across renders,
	 * `reset()` restores to the newest default, not the original mount-time one.
	 */
	defaultSelectedIds?: readonly TId[];

	/**
	 * Predicate that marks certain ids as non-selectable.
	 *
	 * @remarks
	 * Enforced on every operation that **adds** to the selection (`select`,
	 * `toggle`'s select-direction, `selectMultiple`, `selectAll`, `toggleAll`,
	 * `invertSelection`, `replaceSelection`). It never blocks **removal**
	 * (`deselect`, `deselectMultiple`, `retainOnly`, `toggle`'s deselect-direction,
	 * `deselectAll`) — if an already-selected id becomes disabled later, you can
	 * always deselect it, just not re-select it.
	 *
	 * @param id - The id being checked.
	 * @returns `true` if the id must not be added to the selection.
	 */
	isDisabled?: (id: TId) => boolean;
}

/**
 * The `field` requirement, resolved conditionally on whether `T` is already
 * an id (`[T] extends [TId]`) or a full object.
 *
 * @remarks
 * - id-only mode (`T` is assignable to `TId`, e.g. the default `T = SelectionId`):
 *   `field` is forbidden — there's nothing to extract a path from.
 * - object mode: `field` is **required**, and restricted to
 *   {@link SelectionIdPath} — a path that doesn't exist on `T`, or whose
 *   resolved value isn't assignable to `TId`, is a compile-time error rather
 *   than a silent `undefined` id at runtime.
 */
type UseMultipleSelectionFieldOptions<T, TId extends SelectionId> =
	[T] extends [TId] ? { field?: never } : { field: SelectionIdPath<T, TId> };

/**
 * Combined options for {@link useMultipleSelection}. See
 * {@link UseMultipleSelectionBaseOptions} and {@link UseMultipleSelectionFieldOptions}.
 *
 * @typeParam T - The item shape. Defaults to `SelectionId` (id-only mode: pass
 * raw ids as "items", no `field` needed).
 * @typeParam TId - The id type. Defaults to `SelectionId`; narrow it (e.g. to a
 * branded `UserId`) for stronger inference.
 */
type UseMultipleSelectionOptions<
	T = SelectionId,
	TId extends SelectionId = SelectionId,
> = UseMultipleSelectionBaseOptions<T, TId>
	& UseMultipleSelectionFieldOptions<T, TId>;

export { type UseMultipleSelectionOptions };
