import { useCallback, useMemo, useRef, useState } from "react";
import type { ExpansionId, UseExpansionOptions } from "./types.ts";
import {
	resolveExpansionId,
	validateExpansionTarget,
	warnCollapsibleBlocked,
	warnExpandAllSingleMode,
	warnSingleModeTruncated,
} from "./validation.ts";

/**
 * Return value of {@link useExpansion}.
 *
 * @typeParam T - The item shape, or `TId` itself for id-only mode.
 * @typeParam TId - The id type.
 */
interface UseExpansionReturn<
	T = ExpansionId,
	TId extends ExpansionId = ExpansionId,
> {
	/** The currently expanded ids. */
	expandedIds: readonly TId[];

	/** The subset of `items` that are currently expanded. */
	expandedItems: readonly T[];

	/** The subset of `items` that are not currently expanded. */
	collapsedItems: readonly T[];

	/** `expandedIds.length`. */
	expandedCount: number;

	/** Whether anything at all is expanded. */
	hasExpanded: boolean;

	/** Whether `itemOrId` is currently expanded. */
	isExpanded: (itemOrId: TId | T) => boolean;

	/**
	 * Expands `itemOrId`.
	 * @remarks No-ops if it's already expanded. In single mode, also collapses whatever was previously expanded.
	 */
	expand: (itemOrId: TId | T) => void;

	/**
	 * Collapses `itemOrId`.
	 * @remarks No-ops if it isn't currently expanded, or (in single mode) if `collapsible` is `false`.
	 */
	collapse: (itemOrId: TId | T) => void;

	/**
	 * Expands `itemOrId` if it isn't expanded, collapses it if it is.
	 * @remarks In single mode, expanding also collapses whatever was previously expanded; collapsing is blocked when `collapsible` is `false`, same as {@link UseExpansionReturn.collapse}.
	 */
	toggleExpansion: (itemOrId: TId | T) => void;

	/**
	 * Expands every id/item given, or every item in `items` if called with
	 * no argument. Replaces the current expanded set rather than adding to
	 * it.
	 * @remarks No-ops (with a dev warning) when `multiple` is `false` - expanding "all" is meaningless in a mode that only ever allows one item open.
	 */
	expandAll: (itemsArray?: readonly TId[] | readonly T[]) => void;

	/** Collapses every id/item given, or collapses everything if called with no argument. Unlike {@link UseExpansionReturn.expandAll}, not gated by `multiple` - collapsing to nothing is always meaningful. */
	collapseAll: (itemsArray?: readonly TId[] | readonly T[]) => void;

	/** Restores the expanded set to the value `initialExpandedIds` had at mount - see {@link useExpansion}'s remarks. Re-truncated against the *current* `multiple` value, not whatever it was at mount. */
	resetExpansion: () => void;

	/** Replaces the entire expanded set with exactly these ids/items, truncated to just the first if `multiple` is `false` and more than one is given. */
	replaceExpansion: (newExpandedItems: readonly TId[] | readonly T[]) => void;
}

/**
 * Manages which item(s) in a list are expanded - accordions, expandable
 * table rows, collapsible sections.
 *
 * @remarks
 * - Uncontrolled only for now - controlled mode is planned separately and
 *   will be added without breaking this signature.
 * - SSR-safe: performs no DOM/window access; `initialExpandedIds` must be
 *   deterministic between server and client renders to avoid hydration
 *   mismatches.
 * - All returned callbacks are manually memoized with `useCallback` so this
 *   hook is safe to use even in codebases **without** the React Compiler.
 * - Two modes, picked by whether `T` is assignable to `TId`: id-only
 *   (default) - `itemOrId` parameters only ever receive raw ids, `field`
 *   is disallowed; or object mode - `<Row, string>` plus a required
 *   `field`, letting `itemOrId` parameters take a full item too. See
 *   {@link UseExpansionOptions}.
 * - The single/multiple invariant (at most one expanded id when `multiple`
 *   is `false`) is enforced at every entry point that can introduce more
 *   than one id at once - the initial mount, `resetExpansion`, and
 *   `replaceExpansion` - not just `expand`/`toggleExpansion`, which only
 *   ever add one id at a time by construction.
 * - `collapsible` (single mode only) specifically gates the *interactive*
 *   collapse path - `collapse`/`toggleExpansion` closing the one expanded
 *   item. It does not gate `collapseAll` or `replaceExpansion([])`: those
 *   are explicit, deliberate "set state directly" calls, treated the same
 *   as `clearPins`/`replacePins` in `usePin` not respecting `maxPins`
 *   either - a soft interactive constraint doesn't override an explicit
 *   caller instruction.
 *
 * @typeParam T - The item shape, or `TId` itself for id-only mode.
 * @typeParam TId - The id type.
 * @param options - See {@link UseExpansionOptions}.
 * @returns The current expansion state and the actions to change it. See {@link UseExpansionReturn}.
 *
 * @example
 * Accordion (single, non-collapsible - always exactly one open):
 * ```tsx
 * const { isExpanded, toggleExpansion } = useExpansion({
 *   multiple: false,
 *   collapsible: false,
 *   initialExpandedIds: ["section-1"],
 * });
 * ```
 *
 * @example
 * Object mode, multiple expandable rows:
 * ```tsx
 * interface Row { id: string; label: string }
 * const { expandedItems, expand, expandAll } = useExpansion<Row, string>({
 *   items: rows,
 *   field: "id",
 *   multiple: true,
 * });
 * ```
 */
function useExpansion<T = ExpansionId, TId extends ExpansionId = ExpansionId>(
	options: UseExpansionOptions<T, TId> = {} as UseExpansionOptions<T, TId>,
): UseExpansionReturn<T, TId> {
	// UseExpansionOptions is a conditional type so it can require `field`
	// only in object mode at the call site. The implementation body needs
	// one permissive view across both branches.
	const opts = options as {
		items?: readonly T[];
		field?: string;
		initialExpandedIds?: readonly TId[];
		multiple?: boolean;
		collapsible?: boolean;
	};

	const field = opts.field;
	const multiple = !!opts.multiple;
	const collapsible = opts.collapsible ?? true;

	const items = useMemo(
		() => (Array.isArray(opts.items) ? opts.items : []),
		[opts.items],
	);

	const safeInitialExpandedIds = useMemo(
		() =>
			Array.isArray(opts.initialExpandedIds) ? opts.initialExpandedIds : [],
		[opts.initialExpandedIds],
	);
	const initialIdsRef = useRef(safeInitialExpandedIds);

	const [expandedIdsSet, setExpandedIdsSet] = useState<Set<TId>>(() => {
		const deduped = [...new Set(safeInitialExpandedIds)];

		if (!multiple && deduped.length > 1) {
			warnSingleModeTruncated("useExpansion", deduped.length);
			return new Set(deduped.slice(0, 1));
		}

		return new Set(deduped);
	});

	const isExpanded = useCallback(
		(itemOrId: TId | T) => {
			if (!validateExpansionTarget(itemOrId, field, "isExpanded"))
				return false;

			const id = resolveExpansionId<T, TId>(itemOrId, field, "isExpanded");
			return id !== undefined && expandedIdsSet.has(id);
		},
		[expandedIdsSet, field],
	);

	const expand = useCallback(
		(itemOrId: TId | T) => {
			if (!validateExpansionTarget(itemOrId, field, "expand")) return;

			setExpandedIdsSet((prev) => {
				const id = resolveExpansionId<T, TId>(itemOrId, field, "expand");
				if (id === undefined || prev.has(id)) return prev;

				const newSet = multiple ? new Set(prev) : new Set<TId>();
				newSet.add(id);
				return newSet;
			});
		},
		[field, multiple],
	);

	const collapse = useCallback(
		(itemOrId: TId | T) => {
			if (!validateExpansionTarget(itemOrId, field, "collapse")) return;

			setExpandedIdsSet((prev) => {
				const id = resolveExpansionId<T, TId>(itemOrId, field, "collapse");
				if (id === undefined || !prev.has(id)) return prev;

				if (!multiple && !collapsible) {
					warnCollapsibleBlocked("collapse");
					return prev;
				}

				const newSet = new Set(prev);
				newSet.delete(id);
				return newSet;
			});
		},
		[field, multiple, collapsible],
	);

	const toggleExpansion = useCallback(
		(itemOrId: TId | T) => {
			if (!validateExpansionTarget(itemOrId, field, "toggleExpansion")) return;

			setExpandedIdsSet((prev) => {
				const id = resolveExpansionId<T, TId>(
					itemOrId,
					field,
					"toggleExpansion",
				);
				if (id === undefined) return prev;

				if (prev.has(id)) {
					if (!multiple && !collapsible) {
						warnCollapsibleBlocked("toggleExpansion");
						return prev;
					}

					const newSet = multiple ? new Set(prev) : new Set<TId>();
					newSet.delete(id);
					return newSet;
				}

				const newSet = multiple ? new Set(prev) : new Set<TId>();
				newSet.add(id);
				return newSet;
			});
		},
		[field, multiple, collapsible],
	);

	const expandAll = useCallback(
		(itemsArray?: readonly TId[] | readonly T[]) => {
			if (!multiple) {
				warnExpandAllSingleMode();
				return;
			}

			// No argument -> act on the hook's own `items`, not "do nothing."
			const safeItems = Array.isArray(itemsArray) ? itemsArray : items;

			const ids: TId[] = [];
			for (const item of safeItems) {
				const id = resolveExpansionId<T, TId>(item, field, "expandAll");
				if (id !== undefined) ids.push(id);
			}

			setExpandedIdsSet(new Set(ids));
		},
		[items, field, multiple],
	);

	const collapseAll = useCallback(
		(itemsArray?: readonly TId[] | readonly T[]) => {
			// No argument means "collapse everything" (a blanket clear), not
			// "act on the hook's own `items`" - unlike expandAll, since a
			// subset of items being collapsed already fully describes what to
			// remove, but "collapse nothing was specified" reads most
			// naturally as "collapse all."
			if (itemsArray === undefined) {
				setExpandedIdsSet((prev) => (prev.size === 0 ? prev : new Set()));
				return;
			}

			const safeItems = Array.isArray(itemsArray) ? itemsArray : [];

			setExpandedIdsSet((prev) => {
				const newSet = new Set(prev);

				for (const item of safeItems) {
					if (!validateExpansionTarget(item, field, "collapseAll"))
						continue;

					const id = resolveExpansionId<T, TId>(
						item,
						field,
						"collapseAll",
					);
					if (id !== undefined) newSet.delete(id);
				}

				return newSet;
			});
		},
		[field],
	);

	const resetExpansion = useCallback(() => {
		const initial = initialIdsRef.current;

		if (!multiple && initial.length > 1) {
			warnSingleModeTruncated("resetExpansion", initial.length);
			setExpandedIdsSet(new Set(initial.slice(0, 1)));
			return;
		}

		setExpandedIdsSet(new Set(initial));
	}, [multiple]);

	const replaceExpansion = useCallback(
		(newExpandedItems: readonly TId[] | readonly T[]) => {
			const safeItems =
				Array.isArray(newExpandedItems) ? newExpandedItems : [];

			const ids: TId[] = [];
			for (const item of safeItems) {
				if (!validateExpansionTarget(item, field, "replaceExpansion"))
					continue;

				const id = resolveExpansionId<T, TId>(
					item,
					field,
					"replaceExpansion",
				);
				if (id !== undefined) ids.push(id);
			}

			const deduped = [...new Set(ids)];

			if (!multiple && deduped.length > 1) {
				warnSingleModeTruncated("replaceExpansion", deduped.length);
				setExpandedIdsSet(new Set(deduped.slice(0, 1)));
				return;
			}

			setExpandedIdsSet(new Set(deduped));
		},
		[field, multiple],
	);

	const expandedIds = useMemo(() => [...expandedIdsSet], [expandedIdsSet]);

	// Single pass over `items`, not two separate .filter() calls - both
	// arrays need the same per-item id resolution anyway.
	const { expandedItems, collapsedItems } = useMemo(() => {
		const expanded: T[] = [];
		const collapsed: T[] = [];

		for (const item of items) {
			const id = resolveExpansionId<T, TId>(item, field, "expandedItems");

			if (id !== undefined && expandedIdsSet.has(id)) expanded.push(item);
			else collapsed.push(item);
		}

		return { expandedItems: expanded, collapsedItems: collapsed };
	}, [items, field, expandedIdsSet]);

	return {
		expandedIds,
		expandedItems,
		collapsedItems,
		expandedCount: expandedIdsSet.size,
		hasExpanded: expandedIdsSet.size > 0,
		isExpanded,
		expand,
		collapse,
		toggleExpansion,
		expandAll,
		collapseAll,
		resetExpansion,
		replaceExpansion,
	};
}

export { type UseExpansionReturn, useExpansion };
