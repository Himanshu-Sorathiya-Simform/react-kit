import type { SelectionId } from "../../shared/selectionShared/types.ts";

/**
 * Configuration options for {@link useSingleSelection}.
 *
 * @typeParam TId - The concrete id type used by this selection instance.
 * Must be assignable to {@link SelectionId} (`string | number`), but can be
 * a narrower/branded type (e.g. `UserId`) for stronger inference at call sites.
 */
interface UseSingleSelectionOptions<TId extends SelectionId = SelectionId> {
	/**
	 * The id that is selected on mount, and the id that {@link UseSingleSelectionReturn.reset}
	 * returns the selection to.
	 *
	 * @remarks
	 * Only the value present on the **first render** is used to seed state
	 * (standard `useState` initializer semantics — later changes to this value
	 * do not retroactively change the current selection). However, `reset()`
	 * always reads the **latest** `defaultSelectedId` at the time it's called,
	 * so if this value changes across renders, `reset()` will restore to the
	 * newest default, not the original mount-time one.
	 */
	defaultSelectedId?: TId;

	/**
	 * Predicate that marks certain ids as non-selectable.
	 *
	 * @remarks
	 * This guard is only enforced inside {@link UseSingleSelectionReturn.select}
	 * and {@link UseSingleSelectionReturn.toggle}. It does **not** retroactively
	 * clear a selection if an already-selected id later becomes disabled — the
	 * hook has no way to know `isDisabled`'s result changed unless you call
	 * `select`/`toggle` again. Reconcile that case yourself (e.g. via an effect)
	 * if it matters for your use case.
	 *
	 * @param id - The id being checked before selection.
	 * @returns `true` if the id must not be selectable.
	 */
	isDisabled?: (id: TId) => boolean;
}

export { type SelectionId, type UseSingleSelectionOptions };
