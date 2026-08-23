import { useCallback, useMemo, useRef, useState } from "react";
import type { UseVisibilityOptions, VisibilityId } from "./types.ts";
import { resolveVisibilityId, validateVisibilityTarget } from "./validation.ts";

/**
 * Return value of {@link useVisibility}.
 *
 * @typeParam T - The item shape, or `TId` itself for id-only mode.
 * @typeParam TId - The id type.
 */
interface UseVisibilityReturn<
	T = VisibilityId,
	TId extends VisibilityId = VisibilityId,
> {
	/** The currently visible ids. */
	visibleIds: readonly TId[];

	/** The subset of `items` that are currently visible. */
	visibleItems: readonly T[];

	/** The subset of `items` that are currently hidden. */
	hiddenItems: readonly T[];

	/** `visibleIds.length`. */
	visibleCount: number;

	/** `hiddenItems.length`. */
	hiddenCount: number;

	/** Whether anything at all is visible. */
	hasVisible: boolean;

	/** Whether `itemOrId` is currently visible. */
	isVisible: (itemOrId: TId | T) => boolean;

	/** Shows `itemOrId`. No-ops if it's already visible. */
	show: (itemOrId: TId | T) => void;

	/** Hides `itemOrId`. No-ops if it's already hidden. */
	hide: (itemOrId: TId | T) => void;

	/** Shows `itemOrId` if it's hidden, hides it if it's visible. */
	toggleVisibility: (itemOrId: TId | T) => void;

	/** Shows every id/item given, or every item in `items` if called with no argument. Adds to the current visible set rather than replacing it. */
	showAll: (itemsArray?: readonly TId[] | readonly T[]) => void;

	/**
	 * Hides every id/item given, or hides everything if called with no
	 * argument.
	 * @remarks Unlike {@link UseVisibilityReturn.showAll}, "no argument" means a blanket clear, not "act on the hook's own `items`" - see {@link useVisibility}'s remarks.
	 */
	hideAll: (itemsArray?: readonly TId[] | readonly T[]) => void;

	/** Restores the visible set to the value `initialVisibleIds` had at mount - see {@link useVisibility}'s remarks. */
	resetVisibility: () => void;

	/** Replaces the entire visible set with exactly these ids/items. */
	replaceVisibility: (newVisibleItems: readonly TId[] | readonly T[]) => void;
}

/**
 * Manages which item(s) in a list are visible - show/hide toggles, column
 * visibility, filterable chip lists.
 *
 * @remarks
 * - Uncontrolled only for now - controlled mode is planned separately and
 *   will be added without breaking this signature.
 * - SSR-safe: performs no DOM/window access; `initialVisibleIds` must be
 *   deterministic between server and client renders to avoid hydration
 *   mismatches.
 * - All returned callbacks are manually memoized with `useCallback` so this
 *   hook is safe to use even in codebases **without** the React Compiler.
 * - Two modes, picked by whether `T` is assignable to `TId`: id-only
 *   (default) - `itemOrId` parameters only ever receive raw ids, `field`
 *   is disallowed; or object mode - `<Row, string>` plus a required
 *   `field`, letting `itemOrId` parameters take a full item too. See
 *   {@link UseVisibilityOptions}.
 * - `showAll`/`hideAll` intentionally differ in what "no argument" means:
 *   `showAll()` acts on the hook's own `items` (additive - anything
 *   already visible but no longer in `items` is left alone), while
 *   `hideAll()` is a blanket clear regardless of `items` (so a
 *   previously-visible id that's since fallen out of `items` doesn't stay
 *   visible forever). Passing an explicit array to either scopes it to
 *   just that subset.
 *
 * @typeParam T - The item shape, or `TId` itself for id-only mode.
 * @typeParam TId - The id type.
 * @param options - See {@link UseVisibilityOptions}.
 * @returns The current visibility state and the actions to change it. See {@link UseVisibilityReturn}.
 *
 * @example
 * Id-only:
 * ```tsx
 * const { isVisible, toggleVisibility } = useVisibility({
 *   initialVisibleIds: ["col-name", "col-email"],
 * });
 * ```
 *
 * @example
 * Object mode:
 * ```tsx
 * interface Column { id: string; label: string }
 * const { visibleItems, hide, showAll } = useVisibility<Column, string>({
 *   items: columns,
 *   field: "id",
 * });
 * ```
 */
function useVisibility<T = VisibilityId, TId extends VisibilityId = VisibilityId>(
	options: UseVisibilityOptions<T, TId> = {} as UseVisibilityOptions<T, TId>,
): UseVisibilityReturn<T, TId> {
	// UseVisibilityOptions is a conditional type so it can require `field`
	// only in object mode at the call site. The implementation body needs
	// one permissive view across both branches.
	const opts = options as {
		items?: readonly T[];
		field?: string;
		initialVisibleIds?: readonly TId[];
	};

	const field = opts.field;

	const items = useMemo(
		() => (Array.isArray(opts.items) ? opts.items : []),
		[opts.items],
	);

	const safeInitialVisibleIds = useMemo(
		() => (Array.isArray(opts.initialVisibleIds) ? opts.initialVisibleIds : []),
		[opts.initialVisibleIds],
	);
	const initialIdsRef = useRef(safeInitialVisibleIds);

	const [visibleIdsSet, setVisibleIdsSet] = useState<Set<TId>>(
		() => new Set(safeInitialVisibleIds),
	);

	const isVisible = useCallback(
		(itemOrId: TId | T) => {
			if (!validateVisibilityTarget(itemOrId, field, "isVisible"))
				return false;

			const id = resolveVisibilityId<T, TId>(itemOrId, field, "isVisible");
			return id !== undefined && visibleIdsSet.has(id);
		},
		[visibleIdsSet, field],
	);

	const show = useCallback(
		(itemOrId: TId | T) => {
			if (!validateVisibilityTarget(itemOrId, field, "show")) return;

			setVisibleIdsSet((prev) => {
				const id = resolveVisibilityId<T, TId>(itemOrId, field, "show");
				if (id === undefined || prev.has(id)) return prev;

				const newSet = new Set(prev);
				newSet.add(id);
				return newSet;
			});
		},
		[field],
	);

	const hide = useCallback(
		(itemOrId: TId | T) => {
			if (!validateVisibilityTarget(itemOrId, field, "hide")) return;

			setVisibleIdsSet((prev) => {
				const id = resolveVisibilityId<T, TId>(itemOrId, field, "hide");
				if (id === undefined || !prev.has(id)) return prev;

				const newSet = new Set(prev);
				newSet.delete(id);
				return newSet;
			});
		},
		[field],
	);

	const toggleVisibility = useCallback(
		(itemOrId: TId | T) => {
			if (!validateVisibilityTarget(itemOrId, field, "toggleVisibility"))
				return;

			setVisibleIdsSet((prev) => {
				const id = resolveVisibilityId<T, TId>(
					itemOrId,
					field,
					"toggleVisibility",
				);
				if (id === undefined) return prev;

				const newSet = new Set(prev);
				if (newSet.has(id)) newSet.delete(id);
				else newSet.add(id);

				return newSet;
			});
		},
		[field],
	);

	const showAll = useCallback(
		(itemsArray?: readonly TId[] | readonly T[]) => {
			// No argument -> act on the hook's own `items`, not "do nothing."
			const safeItems = Array.isArray(itemsArray) ? itemsArray : items;

			setVisibleIdsSet((prev) => {
				const newSet = new Set(prev);

				for (const item of safeItems) {
					if (!validateVisibilityTarget(item, field, "showAll")) continue;

					const id = resolveVisibilityId<T, TId>(item, field, "showAll");
					if (id !== undefined) newSet.add(id);
				}

				return newSet;
			});
		},
		[items, field],
	);

	const hideAll = useCallback(
		(itemsArray?: readonly TId[] | readonly T[]) => {
			// No argument means "hide everything" (a blanket clear), not "act
			// on the hook's own `items`" - unlike showAll, since a subset of
			// items being hidden already fully describes what to remove, but
			// "hide nothing was specified" reads most naturally as "hide all."
			if (itemsArray === undefined) {
				setVisibleIdsSet((prev) => (prev.size === 0 ? prev : new Set()));
				return;
			}

			const safeItems = Array.isArray(itemsArray) ? itemsArray : [];

			setVisibleIdsSet((prev) => {
				const newSet = new Set(prev);

				for (const item of safeItems) {
					if (!validateVisibilityTarget(item, field, "hideAll")) continue;

					const id = resolveVisibilityId<T, TId>(item, field, "hideAll");
					if (id !== undefined) newSet.delete(id);
				}

				return newSet;
			});
		},
		[field],
	);

	const resetVisibility = useCallback(() => {
		setVisibleIdsSet(new Set(initialIdsRef.current));
	}, []);

	const replaceVisibility = useCallback(
		(newVisibleItems: readonly TId[] | readonly T[]) => {
			const safeItems = Array.isArray(newVisibleItems) ? newVisibleItems : [];

			const ids: TId[] = [];
			for (const item of safeItems) {
				if (!validateVisibilityTarget(item, field, "replaceVisibility"))
					continue;

				const id = resolveVisibilityId<T, TId>(
					item,
					field,
					"replaceVisibility",
				);
				if (id !== undefined) ids.push(id);
			}

			setVisibleIdsSet(new Set(ids));
		},
		[field],
	);

	const visibleIds = useMemo(() => [...visibleIdsSet], [visibleIdsSet]);

	// Single pass over `items`, not two separate .filter() calls - both
	// arrays need the same per-item id resolution anyway.
	const { visibleItems, hiddenItems } = useMemo(() => {
		const visible: T[] = [];
		const hidden: T[] = [];

		for (const item of items) {
			const id = resolveVisibilityId<T, TId>(item, field, "visibleItems");

			if (id !== undefined && visibleIdsSet.has(id)) visible.push(item);
			else hidden.push(item);
		}

		return { visibleItems: visible, hiddenItems: hidden };
	}, [items, field, visibleIdsSet]);

	return {
		visibleIds,
		visibleItems,
		hiddenItems,
		visibleCount: visibleIdsSet.size,
		hiddenCount: hiddenItems.length,
		hasVisible: visibleIdsSet.size > 0,
		isVisible,
		show,
		hide,
		toggleVisibility,
		showAll,
		hideAll,
		resetVisibility,
		replaceVisibility,
	};
}

export { type UseVisibilityReturn, useVisibility };
