import { useCallback, useState } from "react";
import type { SelectionId, UseSingleSelectionOptions } from "./types.ts";

/**
 * Return shape of {@link useSingleSelection}.
 *
 * @typeParam TId - The concrete id type used by this selection instance.
 */
interface UseSingleSelectionReturn<TId extends SelectionId = SelectionId> {
	/** The currently selected id, or `undefined` if nothing is selected. */
	selectedId: TId | undefined;

	/**
	 * Whether any id is currently selected.
	 *
	 * @remarks
	 * Correctly distinguishes "nothing selected" from a falsy-but-valid id
	 * such as `0` or `""` — this is `selectedId !== undefined`, not `!!selectedId`.
	 */
	hasSelection: boolean;

	/**
	 * Selects the given id, replacing any current selection.
	 *
	 * @remarks No-ops if `id` is disabled per `isDisabled`.
	 * @param id - The id to select.
	 */
	select: (id: TId) => void;

	/** Clears the current selection (sets it to `undefined`). */
	deselect: () => void;

	/**
	 * Selects `id` if it isn't already selected; deselects it if it is.
	 *
	 * @remarks No-ops if `id` is disabled per `isDisabled`.
	 * @param id - The id to toggle.
	 */
	toggle: (id: TId) => void;

	/**
	 * Checks whether the given id is the currently selected one.
	 *
	 * @param id - The id to check.
	 * @returns `true` if `id` is currently selected.
	 */
	isSelected: (id: TId) => boolean;

	/**
	 * Restores the selection to the current `defaultSelectedId`
	 * (or `undefined` if none was provided).
	 */
	reset: () => void;
}

/**
 * Manages single-item selection state (e.g. a radio group, a single-select
 * list, an active tab/row).
 *
 * @remarks
 * - Uncontrolled only for now — controlled mode (`selectedId` + `onSelectionChange`)
 *   is planned separately and will be added without breaking this signature.
 * - SSR-safe: performs no DOM/window access; `defaultSelectedId` must be
 *   deterministic between server and client renders to avoid hydration mismatches.
 * - All returned callbacks are manually memoized with `useCallback` so this
 *   hook is safe to use even in codebases **without** the React Compiler.
 *
 * @typeParam TId - The concrete id type used by this selection instance.
 * @param options - Optional configuration. See {@link UseSingleSelectionOptions}.
 * @returns The current selection state and the actions to mutate it. See {@link UseSingleSelectionReturn}.
 *
 * @example
 * ```tsx
 * const { selectedId, select, isSelected } = useSingleSelection<string>({
 *   defaultSelectedId: "row-1",
 * });
 * ```
 */
function useSingleSelection<TId extends SelectionId = SelectionId>(
	options: UseSingleSelectionOptions<TId> = {},
): UseSingleSelectionReturn<TId> {
	const { defaultSelectedId, isDisabled } = options;

	const [selectedId, setSelectedId] = useState<TId | undefined>(defaultSelectedId);

	const select = useCallback(
		(id: TId) => {
			if (isDisabled?.(id)) return;
			setSelectedId(id);
		},
		[isDisabled],
	);

	const deselect = useCallback(() => setSelectedId(undefined), []);

	const toggle = useCallback(
		(id: TId) => {
			if (isDisabled?.(id)) return;
			setSelectedId((prev) => (prev === id ? undefined : id));
		},
		[isDisabled],
	);

	const isSelected = useCallback((id: TId) => selectedId === id, [selectedId]);

	const reset = useCallback(
		() => setSelectedId(defaultSelectedId),
		[defaultSelectedId],
	);

	return {
		selectedId,
		hasSelection: selectedId !== undefined,
		select,
		deselect,
		toggle,
		isSelected,
		reset,
	};
}

export { type UseSingleSelectionReturn, useSingleSelection };
