import { useCallback, useMemo, useRef, useState } from "react";
import type { PinId, UsePinOptions } from "./types.ts";
import {
	resolveMaxPins,
	resolvePinId,
	validatePinTarget,
	warnPinLimitReached,
	warnPinsTruncated,
} from "./validation.ts";

/**
 * Return value of {@link usePin}.
 *
 * @typeParam T - The item shape, or `TId` itself for id-only mode.
 * @typeParam TId - The id type.
 */
interface UsePinReturn<T = PinId, TId extends PinId = PinId> {
	/** The currently pinned ids. */
	pinnedIds: readonly TId[];

	/** The subset of `items` that are currently pinned. */
	pinnedItems: readonly T[];

	/** The subset of `items` that are not currently pinned. */
	unpinnedItems: readonly T[];

	/** `pinnedIds.length`. */
	pinnedCount: number;

	/** Whether anything at all is pinned. */
	hasPins: boolean;

	/** Whether `pinnedCount` has reached `maxPins`. */
	isAtMaxLimit: boolean;

	/** The current pin limit - `Number.MAX_SAFE_INTEGER` when unset/unlimited. */
	maxPins: number;

	/**
	 * Pins `itemOrId`.
	 * @remarks No-ops if it's already pinned, or if `maxPins` has been reached.
	 */
	pin: (itemOrId: TId | T) => void;

	/** Unpins `itemOrId`. Always allowed, even past `maxPins` - removal never needs to check the limit. */
	unpin: (itemOrId: TId | T) => void;

	/**
	 * Pins `itemOrId` if it isn't pinned, unpins it if it is.
	 * @remarks The pin-direction is blocked once `maxPins` is reached; the unpin-direction never is.
	 */
	togglePin: (itemOrId: TId | T) => void;

	/** Whether `itemOrId` is currently pinned. */
	isPinned: (itemOrId: TId | T) => boolean;

	/** Whether {@link UsePinReturn.pin} would currently have an effect for `itemOrId` - `true` if it's already pinned (a no-op call still "succeeds") or there's room under `maxPins`. */
	canPin: (itemOrId: TId | T) => boolean;

	/** Unpins everything. */
	clearPins: () => void;

	/** Restores the pinned set to the value `initialPinnedIds` had at mount - see {@link usePin}'s remarks. */
	resetPins: () => void;

	/** Replaces the entire pinned set with exactly these ids/items, truncated to the first `maxPins` if it exceeds the current limit. */
	replacePins: (newPinnedItems: readonly TId[] | readonly T[]) => void;

	/**
	 * Pins every id/item given, or every item in `items` if called with no
	 * argument.
	 * @remarks If `maxPins` is reached partway through, whatever already fit stays pinned rather than the whole call being rejected.
	 */
	pinAll: (itemsArray?: readonly TId[] | readonly T[]) => void;

	/** Unpins every id/item given, or unpins everything if called with no argument. */
	unpinAll: (itemsArray?: readonly TId[] | readonly T[]) => void;

	/** Changes `maxPins` to a new value. Does not retroactively unpin anything already over the new limit. */
	changeMaxPins: (newMaxPins: number) => void;

	/** Restores `maxPins` to the value it had at mount. */
	resetMaxPins: () => void;
}

/**
 * Manages a pinned/starred subset of a list - pinned rows in a table,
 * favorited items, "keep at top" behavior.
 *
 * @remarks
 * - Uncontrolled only for now - controlled mode is planned separately and
 *   will be added without breaking this signature.
 * - SSR-safe: performs no DOM/window access; `initialPinnedIds` must be
 *   deterministic between server and client renders to avoid hydration
 *   mismatches.
 * - All returned callbacks are manually memoized with `useCallback` so this
 *   hook is safe to use even in codebases **without** the React Compiler.
 * - Two modes, picked by whether `T` is assignable to `TId`: id-only
 *   (default) - `itemOrId` parameters only ever receive raw ids, `field`
 *   is disallowed; or object mode - `<Row, string>` plus a required
 *   `field`, letting `itemOrId` parameters take a full item too. See
 *   {@link UsePinOptions}.
 * - `maxPins` truncation always keeps the *first* ids/items and warns in
 *   dev about the rest - this applies at mount (`initialPinnedIds`),
 *   `replacePins`, and `pinAll`.
 * - `resetPins` and `resetMaxPins` are independent - resetting one doesn't
 *   touch the other, and each restores exactly the value its own option
 *   had at mount, not whatever it is on the current render.
 *
 * @typeParam T - The item shape, or `TId` itself for id-only mode.
 * @typeParam TId - The id type.
 * @param options - See {@link UsePinOptions}.
 * @returns The current pinned state and the actions to change it. See {@link UsePinReturn}.
 *
 * @example
 * Id-only:
 * ```tsx
 * const { pinnedIds, pin, isPinned } = usePin({ initialPinnedIds: ["row-1"] });
 * ```
 *
 * @example
 * Object mode, with a pin limit:
 * ```tsx
 * interface Row { id: string; label: string }
 * const { pinnedItems, pin, canPin } = usePin<Row, string>({
 *   items: rows,
 *   field: "id",
 *   maxPins: 5,
 * });
 * ```
 */
function usePin<T = PinId, TId extends PinId = PinId>(
	options: UsePinOptions<T, TId> = {} as UsePinOptions<T, TId>,
): UsePinReturn<T, TId> {
	// UsePinOptions is a conditional type so it can require `field` only in
	// object mode at the call site. The implementation body needs one
	// permissive view across both branches.
	const opts = options as {
		items?: readonly T[];
		field?: string;
		initialPinnedIds?: readonly TId[];
		maxPins?: number;
	};

	const field = opts.field;

	const items = useMemo(
		() => (Array.isArray(opts.items) ? opts.items : []),
		[opts.items],
	);

	const safeInitialPinnedIds = useMemo(
		() => (Array.isArray(opts.initialPinnedIds) ? opts.initialPinnedIds : []),
		[opts.initialPinnedIds],
	);
	const initialPinnedIdsRef = useRef(safeInitialPinnedIds);

	const [maxPins, setMaxPins] = useState(() =>
		resolveMaxPins(opts.maxPins, "usePin"),
	);
	const initialMaxPinsRef = useRef(maxPins);

	const [pinnedIdsSet, setPinnedIdsSet] = useState<Set<TId>>(() => {
		const deduped = [...new Set(safeInitialPinnedIds)];

		// Enforced here too, not just in replacePins/pinAll - initialPinnedIds
		// exceeding maxPins at mount would otherwise start the hook in a state
		// none of the other setters would ever produce.
		if (deduped.length > maxPins) {
			warnPinsTruncated("usePin", deduped.length, maxPins);
		}

		return new Set(deduped.slice(0, maxPins));
	});

	const pin = useCallback(
		(itemOrId: TId | T) => {
			if (!validatePinTarget(itemOrId, field, "pin")) return;

			setPinnedIdsSet((prev) => {
				const id = resolvePinId<T, TId>(itemOrId, field, "pin");
				if (id === undefined || prev.has(id)) return prev;

				if (prev.size >= maxPins) {
					warnPinLimitReached("pin");
					return prev;
				}

				const newSet = new Set(prev);
				newSet.add(id);
				return newSet;
			});
		},
		[field, maxPins],
	);

	const unpin = useCallback(
		(itemOrId: TId | T) => {
			if (!validatePinTarget(itemOrId, field, "unpin")) return;

			setPinnedIdsSet((prev) => {
				const id = resolvePinId<T, TId>(itemOrId, field, "unpin");
				if (id === undefined || !prev.has(id)) return prev;

				const newSet = new Set(prev);
				newSet.delete(id);
				return newSet;
			});
		},
		[field],
	);

	const togglePin = useCallback(
		(itemOrId: TId | T) => {
			if (!validatePinTarget(itemOrId, field, "togglePin")) return;

			setPinnedIdsSet((prev) => {
				const id = resolvePinId<T, TId>(itemOrId, field, "togglePin");
				if (id === undefined) return prev;

				if (prev.has(id)) {
					const newSet = new Set(prev);
					newSet.delete(id);
					return newSet;
				}

				if (prev.size >= maxPins) {
					warnPinLimitReached("togglePin");
					return prev;
				}

				const newSet = new Set(prev);
				newSet.add(id);
				return newSet;
			});
		},
		[field, maxPins],
	);

	const isPinned = useCallback(
		(itemOrId: TId | T) => {
			if (!validatePinTarget(itemOrId, field, "isPinned")) return false;

			const id = resolvePinId<T, TId>(itemOrId, field, "isPinned");
			return id !== undefined && pinnedIdsSet.has(id);
		},
		[pinnedIdsSet, field],
	);

	const canPin = useCallback(
		(itemOrId: TId | T) => {
			if (!validatePinTarget(itemOrId, field, "canPin")) return false;

			const id = resolvePinId<T, TId>(itemOrId, field, "canPin");
			if (id === undefined) return false;

			return pinnedIdsSet.has(id) || pinnedIdsSet.size < maxPins;
		},
		[pinnedIdsSet, field, maxPins],
	);

	const clearPins = useCallback(() => {
		setPinnedIdsSet((prev) => (prev.size === 0 ? prev : new Set()));
	}, []);

	const resetPins = useCallback(() => {
		setPinnedIdsSet(new Set(initialPinnedIdsRef.current));
	}, []);

	const replacePins = useCallback(
		(newPinnedItems: readonly TId[] | readonly T[]) => {
			const safeItems = Array.isArray(newPinnedItems) ? newPinnedItems : [];

			const ids: TId[] = [];
			for (const item of safeItems) {
				if (!validatePinTarget(item, field, "replacePins")) continue;

				const id = resolvePinId<T, TId>(item, field, "replacePins");
				if (id !== undefined) ids.push(id);
			}

			const deduped = [...new Set(ids)];

			if (deduped.length > maxPins) {
				warnPinsTruncated("replacePins", deduped.length, maxPins);
			}

			setPinnedIdsSet(new Set(deduped.slice(0, maxPins)));
		},
		[field, maxPins],
	);

	const pinAll = useCallback(
		(itemsArray?: readonly TId[] | readonly T[]) => {
			// No argument -> act on the hook's own `items`, not "do nothing."
			const safeItems = Array.isArray(itemsArray) ? itemsArray : items;

			setPinnedIdsSet((prev) => {
				const newSet = new Set(prev);

				for (const item of safeItems) {
					if (!validatePinTarget(item, field, "pinAll")) continue;

					const id = resolvePinId<T, TId>(item, field, "pinAll");
					if (id === undefined) continue;

					if (newSet.size >= maxPins && !newSet.has(id)) {
						warnPinLimitReached("pinAll");
						break;
					}

					newSet.add(id);
				}

				return newSet;
			});
		},
		[field, maxPins, items],
	);

	const unpinAll = useCallback(
		(itemsArray?: readonly TId[] | readonly T[]) => {
			// No argument means "unpin everything" (a blanket clear), not "act
			// on the hook's own `items`" - unlike pinAll, since a subset of
			// items being unpinned already fully describes what to remove, but
			// "unpin nothing was specified" reads most naturally as "clear all."
			if (itemsArray === undefined) {
				setPinnedIdsSet((prev) => (prev.size === 0 ? prev : new Set()));
				return;
			}

			const safeItems = Array.isArray(itemsArray) ? itemsArray : [];

			setPinnedIdsSet((prev) => {
				const newSet = new Set(prev);

				for (const item of safeItems) {
					if (!validatePinTarget(item, field, "unpinAll")) continue;

					const id = resolvePinId<T, TId>(item, field, "unpinAll");
					if (id !== undefined) newSet.delete(id);
				}

				return newSet;
			});
		},
		[field],
	);

	const changeMaxPins = useCallback((newMaxPins: number) => {
		setMaxPins(resolveMaxPins(newMaxPins, "changeMaxPins"));
	}, []);

	const resetMaxPins = useCallback(() => {
		setMaxPins(initialMaxPinsRef.current);
	}, []);

	const pinnedIds = useMemo(() => [...pinnedIdsSet], [pinnedIdsSet]);

	// Single pass over `items`, not two separate .filter() calls - both
	// arrays need the same per-item id resolution anyway.
	const { pinnedItems, unpinnedItems } = useMemo(() => {
		const pinned: T[] = [];
		const unpinned: T[] = [];

		for (const item of items) {
			const id = resolvePinId<T, TId>(item, field, "pinnedItems");

			if (id !== undefined && pinnedIdsSet.has(id)) pinned.push(item);
			else unpinned.push(item);
		}

		return { pinnedItems: pinned, unpinnedItems: unpinned };
	}, [items, field, pinnedIdsSet]);

	return {
		pinnedIds,
		pinnedItems,
		unpinnedItems,
		pinnedCount: pinnedIdsSet.size,
		hasPins: pinnedIdsSet.size > 0,
		isAtMaxLimit: pinnedIdsSet.size >= maxPins,
		maxPins,
		pin,
		unpin,
		togglePin,
		isPinned,
		canPin,
		clearPins,
		resetPins,
		replacePins,
		pinAll,
		unpinAll,
		changeMaxPins,
		resetMaxPins,
	};
}

export { type UsePinReturn, usePin };
