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
import type { UseIntersectionObserverOptions } from "./types.ts";
import { resolveTarget } from "./utils.ts";

/**
 * Return value of {@link useIntersectionObserver}.
 *
 * @typeParam T - Element type of the ref-callback, e.g. pass
 * `useIntersectionObserver<HTMLImageElement>()` for `ref` typed as
 * `RefCallback<HTMLImageElement>` instead of the default `RefCallback<Element>`.
 */
interface UseIntersectionObserverReturn<T extends Element = Element> {
	/**
	 * Attach to your own JSX element to observe it: `<div ref={ref}>`. A
	 * no-op (never called) when `target` is supplied instead.
	 */
	ref: RefCallback<T>;

	/** Whether the target currently intersects `root`, per the last observation. */
	isIntersecting: boolean;

	/** How much of the target is currently visible, from `0` (none) to `1` (fully visible). */
	intersectionRatio: number;

	/** The raw entry from the most recent observation. `undefined` before the first one. */
	entry: IntersectionObserverEntry | undefined;
}

/**
 * Tracks whether an element intersects a root (by default, the viewport),
 * backed by the native `IntersectionObserver` API.
 *
 * @remarks
 * Supports two ways of choosing what to observe - see
 * {@link IntersectionTargetInput} for the full list of accepted shapes:
 * - **Ref-callback mode** (default): attach the returned `ref` to your own
 *   JSX element.
 * - **External target mode**: pass `target` (an element, `RefObject`, or
 *   getter function) to observe something you don't render yourself.
 *
 * `isIntersecting`/`intersectionRatio` reflect `initialIsIntersecting`/`0`
 * until the first observation resolves, which happens asynchronously after
 * mount.
 *
 * @typeParam T - Element type of the ref-callback, e.g. pass
 * `useIntersectionObserver<HTMLImageElement>()` if you want `ref` typed as
 * `RefCallback<HTMLImageElement>` instead of the default `RefCallback<Element>`.
 *
 * @param options - See {@link UseIntersectionObserverOptions}. All fields optional.
 * @returns See {@link UseIntersectionObserverReturn}.
 *
 * @example
 * Lazy-load an image once it's actually visible, then stop observing:
 * ```tsx
 * function LazyImage({ src }: { src: string }) {
 *   const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
 *     freezeOnceVisible: true,
 *     rootMargin: "200px",
 *   });
 *   return <div ref={ref}>{isIntersecting && <img src={src} />}</div>;
 * }
 * ```
 *
 * @example
 * External target mode, observing a scroll-triggered "load more" sentinel:
 * ```tsx
 * const sentinelRef = useRef<HTMLDivElement>(null);
 * const { isIntersecting } = useIntersectionObserver({
 *   target: () => sentinelRef.current,
 *   onChange: (visible) => visible && loadNextPage(),
 * });
 * ```
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API | Intersection Observer API} on MDN
 */
function useIntersectionObserver<T extends Element = Element>(
	options: UseIntersectionObserverOptions = {},
): UseIntersectionObserverReturn<T> {
	const {
		target,
		root = null,
		rootMargin = "0px",
		threshold = 0,
		enabled = true,
		freezeOnceVisible = false,
		initialIsIntersecting = false,
		debounceMs = 0,
		onChange,
	} = options;

	const [refNode, setRefNode] = useState<T | null>(null);
	const ref = useCallback<UseIntersectionObserverReturn<T>["ref"]>((node) => {
		setRefNode(node);
	}, []);

	// target === undefined -> ref-callback mode (use refNode)
	// target === null or a resolved element -> external target mode
	const resolvedExternalTarget =
		target !== undefined ? resolveTarget(target) : undefined;
	const activeTarget: Element | null =
		resolvedExternalTarget !== undefined ? resolvedExternalTarget : refNode;

	const [isIntersecting, setIsIntersecting] = useState(initialIsIntersecting);
	const [intersectionRatio, setIntersectionRatio] = useState(0);
	const [entry, setEntry] = useState<IntersectionObserverEntry | undefined>(
		undefined,
	);
	const frozenRef = useRef(false);

	// Plain, stable callback (not an Effect Event) so it's safe to hand to
	// useDebouncedCallback - Effect Events must only be called from this
	// hook's own effects, never passed into another hook.
	const configRef = useRef({ freezeOnceVisible, onChange });

	useLayoutEffect(() => {
		configRef.current = { freezeOnceVisible, onChange };
	});

	const applyEntry = useCallback((nextEntry: IntersectionObserverEntry) => {
		if (frozenRef.current) return;

		const { freezeOnceVisible: shouldFreeze, onChange: onChangeCb } =
			configRef.current;
		const nextIsIntersecting = nextEntry.isIntersecting;

		setEntry(nextEntry);
		setIsIntersecting((prev) =>
			prev === nextIsIntersecting ? prev : nextIsIntersecting,
		);
		setIntersectionRatio((prev) =>
			prev === nextEntry.intersectionRatio ?
				prev
			:	nextEntry.intersectionRatio,
		);

		onChangeCb?.(nextIsIntersecting, nextEntry);

		if (shouldFreeze && nextIsIntersecting) {
			frozenRef.current = true;
		}
	}, []);

	const { debouncedFunc: debouncedApplyEntry } = useDebouncedCallback(
		applyEntry,
		debounceMs,
	);

	// Effect Event: only ever called from the IntersectionObserver callback
	// set up inside this hook's own useLayoutEffect below.
	const commitEntry = useEffectEvent((entry: IntersectionObserverEntry) => {
		if (debounceMs > 0) {
			debouncedApplyEntry(entry);
		} else {
			applyEntry(entry);
		}
	});

	// Unfreeze when the observed element itself changes - a *new* element
	// deserves a fresh chance to be observed, even if freezeOnceVisible
	// latched for the previous one.
	useLayoutEffect(() => {
		frozenRef.current = false;
	}, [activeTarget]);

	// Extracted to a variable (rather than JSON.stringify(threshold) written
	// inline in the effect's dependency array below) because ESLint's
	// exhaustive-deps rule flags inline complex expressions in a dependency
	// array as unable to be statically checked. Memoizing threshold itself,
	// keyed on its stringified content, means the effect can depend on
	// `stableThreshold` directly - satisfying the rule normally, with no
	// disable comment needed on the outer effect.
	const thresholdKey = JSON.stringify(threshold);
	const stableThreshold = useMemo(
		() => threshold,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[thresholdKey],
	);

	useLayoutEffect(() => {
		if (!activeTarget || !enabled) return;
		if (typeof IntersectionObserver === "undefined") return;
		if (frozenRef.current) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[entries.length - 1];

				if (entry) commitEntry(entry);
			},
			{ root, rootMargin, threshold: stableThreshold },
		);

		observer.observe(activeTarget);

		return () => observer.disconnect();
	}, [activeTarget, root, rootMargin, stableThreshold, enabled]);

	return {
		ref,
		isIntersecting,
		intersectionRatio,
		entry: entry,
	};
}

export { type UseIntersectionObserverReturn, useIntersectionObserver };
