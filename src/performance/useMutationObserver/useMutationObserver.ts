import {
	type RefCallback,
	useCallback,
	useEffectEvent,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useDebouncedCallback } from "../useDebouncer/useDebouncedCallback.ts";
import { EMPTY_RECORDS } from "./constants.ts";
import type { UseMutationObserverOptions } from "./types.ts";
import { resolveTarget } from "./utils.ts";

/**
 * Return value of {@link useMutationObserver}.
 *
 * @typeParam T - Node type of the ref-callback, e.g. pass
 * `useMutationObserver<HTMLDivElement>()` for `ref` typed as
 * `RefCallback<HTMLDivElement>` instead of the default `RefCallback<Element>`.
 */
interface UseMutationObserverReturn<T extends Node = Element> {
	/**
	 * Attach to your own JSX element to observe it: `<div ref={ref}>`. A
	 * no-op (never called) when `target` is supplied instead.
	 */
	ref: RefCallback<T>;

	/** The most recent batch of mutation records. Empty until the first batch arrives. */
	records: MutationRecord[];

	/**
	 * Synchronously flushes and returns any mutation records queued but not
	 * yet delivered to `onMutate`/`records` - a direct passthrough to the
	 * native `MutationObserver.takeRecords()`. Useful immediately before
	 * reading layout, to make sure you're not acting on stale DOM state.
	 */
	takeRecords: () => MutationRecord[];
}

/**
 * Watches a DOM subtree for mutations - child list changes, attribute
 * changes, and/or character data changes - backed by the native
 * `MutationObserver` API.
 *
 * @remarks
 * Supports two ways of choosing what to observe - see
 * {@link MutationTargetInput} for the full list of accepted shapes:
 * - **Ref-callback mode** (default): attach the returned `ref` to your own
 *   JSX element.
 * - **External target mode**: pass `target` (a node, `RefObject`, or getter
 *   function) to observe something you don't render yourself.
 *
 * By default only `childList` is observed - pass `attributes: true`,
 * `characterData: true`, and/or `subtree: true` explicitly to also watch
 * those (see {@link UseMutationObserverOptions} for the full native option
 * set this hook forwards).
 *
 * This is a general-purpose DOM-watching hook, not something
 * {@link useVirtualList}/{@link useVirtualGrid} use internally - item
 * resizing is tracked via `measureElement` (backed by `ResizeObserver`
 * instead, which is the correct tool for size changes specifically).
 *
 * @typeParam T - Node type of the ref-callback, e.g. pass
 * `useMutationObserver<HTMLDivElement>()` if you want `ref` typed as
 * `RefCallback<HTMLDivElement>` instead of the default `RefCallback<Element>`.
 *
 * @param options - See {@link UseMutationObserverOptions}. All fields optional.
 * @returns See {@link UseMutationObserverReturn}.
 *
 * @example
 * Warn in development if a third-party script injects DOM nodes into a container React manages:
 * ```tsx
 * function ManagedContainer() {
 *   const { ref, records } = useMutationObserver<HTMLDivElement>({ subtree: true });
 *   useEffect(() => {
 *     if (records.length) console.warn("Unexpected external DOM mutation", records);
 *   }, [records]);
 *   return <div ref={ref}>{"..."}</div>;
 * }
 * ```
 *
 * @example
 * External target mode, watching a specific attribute:
 * ```tsx
 * const rootRef = useRef<HTMLElement>(document.documentElement);
 * useMutationObserver({
 *   target: () => rootRef.current,
 *   attributes: true,
 *   attributeFilter: ["data-theme"],
 *   onMutate: () => console.log("theme changed"),
 * });
 * ```
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver | MutationObserver} on MDN
 */
function useMutationObserver<T extends Node = Element>(
	options: UseMutationObserverOptions = {},
): UseMutationObserverReturn<T> {
	const {
		target,
		enabled = true,
		debounceMs = 0,
		onMutate,
		childList = true,
		attributes = false,
		attributeFilter,
		attributeOldValue = false,
		characterData = false,
		characterDataOldValue = false,
		subtree = false,
	} = options;

	const [refNode, setRefNode] = useState<T | null>(null);
	const ref = useCallback<UseMutationObserverReturn<T>["ref"]>((node) => {
		setRefNode(node);
	}, []);

	const resolvedExternalTarget =
		target !== undefined ? resolveTarget(target) : undefined;
	const activeTarget: Node | null =
		resolvedExternalTarget !== undefined ? resolvedExternalTarget : refNode;

	const [records, setRecords] = useState<MutationRecord[]>(EMPTY_RECORDS);
	const observerRef = useRef<MutationObserver | null>(null);

	// Plain, stable callback (not an Effect Event) so it's safe to hand to
	// useDebouncedCallback - see the equivalent note in useResizeObserver.
	const onMutateRef = useRef(onMutate);

	useLayoutEffect(() => {
		onMutateRef.current = onMutate;
	});

	const applyRecords = useCallback(
		(mutations: MutationRecord[], observer: MutationObserver) => {
			setRecords(mutations);
			onMutateRef.current?.(mutations, observer);
		},
		[],
	);

	const { debouncedFunc: debouncedApplyRecords } = useDebouncedCallback(
		applyRecords,
		debounceMs,
	);

	// Effect Event: only ever called from the MutationObserver callback set
	// up inside this hook's own useLayoutEffect below.
	const commitRecords = useEffectEvent(
		(mutations: MutationRecord[], observer: MutationObserver) => {
			if (debounceMs > 0) {
				debouncedApplyRecords(mutations, observer);
			} else {
				applyRecords(mutations, observer);
			}
		},
	);

	// Extracted to a variable (rather than JSON.stringify(attributeFilter)
	// written inline in the effect's dependency array below) because
	// ESLint's exhaustive-deps rule flags inline complex expressions in a
	// dependency array as unable to be statically checked. Memoizing
	// attributeFilter itself, keyed on its stringified content, means the
	// effect can depend on `stableAttributeFilter` directly - satisfying
	// the rule normally, with no disable comment needed on the outer effect.
	const attributeFilterKey = JSON.stringify(attributeFilter);
	const stableAttributeFilter = useMemo(
		() => attributeFilter,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[attributeFilterKey],
	);

	useLayoutEffect(() => {
		if (!activeTarget || !enabled) return;
		if (typeof MutationObserver === "undefined") return;

		const observer = new MutationObserver((mutations, obs) => {
			commitRecords(mutations, obs);
		});

		observerRef.current = observer;

		// attributeFilter is spread in conditionally, rather than always
		// present with a possibly-`undefined` value, because the native
		// MutationObserverInit (which this hook can't widen, unlike its own
		// UseMutationObserverOptions) doesn't accept an explicit `undefined`
		// under exactOptionalPropertyTypes - only omission of the key.
		observer.observe(activeTarget, {
			childList,
			attributes,
			attributeOldValue,
			characterData,
			characterDataOldValue,
			subtree,
			...(stableAttributeFilter !== undefined ?
				{ attributeFilter: stableAttributeFilter }
			:	{}),
		});

		return () => {
			observer.disconnect();
			observerRef.current = null;
		};
	}, [
		activeTarget,
		enabled,
		childList,
		attributes,
		attributeOldValue,
		characterData,
		characterDataOldValue,
		subtree,
		stableAttributeFilter,
	]);

	const takeRecords = useCallback(() => {
		return observerRef.current?.takeRecords() ?? [];
	}, []);

	return { ref, records, takeRecords };
}

export { type UseMutationObserverReturn, useMutationObserver };
