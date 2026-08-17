import {
	type RefCallback,
	useCallback,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useDebouncedCallback } from "../useDebouncer/useDebouncedCallback.ts";
import { EMPTY_SIZE } from "./constants.ts";
import type {
	ObservedSize,
	ResizeObserverTargetElement,
	UseResizeObserverOptions,
} from "./types.ts";
import {
	readBoxSize,
	readWindowSize,
	resolveObservableElement,
	resolveTarget,
	sizesEqual,
} from "./utils.ts";

/**
 * Return value of {@link useResizeObserver}.
 *
 * @typeParam T - Element type of the ref-callback, for when you want e.g.
 * `RefCallback<HTMLDivElement>` instead of the default `RefCallback<Element>`.
 */
interface UseResizeObserverReturn<T extends Element = Element> {
	/**
	 * Attach to your own JSX element to observe it:
	 * `<div ref={ref}>`. A no-op (never called) when `target` is supplied
	 * instead.
	 */
	ref: RefCallback<T>;

	/** Latest measured width. `0` until the first measurement (or `initialSize.width`, if provided). */
	width: number;

	/** Latest measured height. `0` until the first measurement (or `initialSize.height`, if provided). */
	height: number;

	/**
	 * The raw entry from the most recent measurement, for reading fields
	 * this hook doesn't surface directly (e.g. `borderBoxSize` alongside a
	 * `box: "content-box"` measurement). `undefined` before the first
	 * measurement, and always `undefined` for `Window` targets.
	 */
	entry: ResizeObserverEntry | undefined;
}

/**
 * Tracks an element's (or the window's) rendered size reactively, backed by
 * the native `ResizeObserver` API.
 *
 * @remarks
 * Supports two ways of choosing what to observe - see
 * {@link ResizeObserverTargetInput} for the full list of accepted shapes:
 * - **Ref-callback mode** (default): attach the returned `ref` to your own
 *   JSX element.
 * - **External target mode**: pass `target` (an element, `RefObject`, or
 *   getter function) to observe something you don't render yourself - for
 *   example, a scroll container obtained via a `getScrollElement()`-style
 *   callback.
 *
 * `width`/`height` are `0` (or `initialSize`, if provided) until the first
 * measurement resolves, which happens asynchronously after mount - so the
 * very first render on the client, and any render during SSR, will not yet
 * reflect the element's real size.
 *
 * @typeParam T - Element type of the ref-callback, e.g. pass
 * `useResizeObserver<HTMLDivElement>()` if you want `ref` typed as
 * `RefCallback<HTMLDivElement>` instead of the default `RefCallback<Element>`.
 *
 * @param options - See {@link UseResizeObserverOptions}. All fields optional.
 * @returns See {@link UseResizeObserverReturn}.
 *
 * @example
 * Ref-callback mode - observe your own element:
 * ```tsx
 * function Panel() {
 *   const { ref, width, height } = useResizeObserver<HTMLDivElement>();
 *   return <div ref={ref}>{width} x {height}</div>;
 * }
 * ```
 *
 * @example
 * External target mode - observe an element you don't render, e.g. a scroll container:
 * ```tsx
 * const scrollRef = useRef<HTMLDivElement>(null);
 * const { width, height } = useResizeObserver({
 *   target: () => scrollRef.current,
 * });
 * ```
 *
 * @example
 * Debounced, rounded, with an imperative side effect:
 * ```tsx
 * const { width, height } = useResizeObserver({
 *   round: true,
 *   debounceMs: 100,
 *   onResize: (size) => redrawCanvas(size),
 * });
 * ```
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver | ResizeObserver} on MDN
 */
function useResizeObserver<T extends Element = Element>(
	options: UseResizeObserverOptions = {},
): UseResizeObserverReturn<T> {
	const {
		target,
		box = "content-box",
		enabled = true,
		round = false,
		debounceMs = 0,
		initialSize,
		onResize,
	} = options;

	const [refNode, setRefNode] = useState<T | null>(null);
	const ref = useCallback<UseResizeObserverReturn<T>["ref"]>((node) => {
		setRefNode(node);
	}, []);

	// target === undefined -> ref-callback mode (use refNode)
	// target === null or a resolved element -> external target mode
	const resolvedExternalTarget =
		target !== undefined ? resolveTarget(target) : undefined;
	const activeTarget: ResizeObserverTargetElement | null =
		resolvedExternalTarget !== undefined ? resolvedExternalTarget : refNode;

	const [size, setSize] = useState<ObservedSize>(() => initialSize ?? EMPTY_SIZE);
	const [entry, setEntry] = useState<ResizeObserverEntry | undefined>(undefined);
	// Tracks the last *applied* size outside of React state, purely so
	// applyMeasurement (a stable useCallback, not a reactive closure) can
	// decide whether this measurement actually changed anything, without
	// reading back the `size` state (which would be stale inside a
	// zero-dependency callback) or reading a ref during render (disallowed -
	// see the note on `entry` above, which this exact pattern replaces).
	const lastSizeRef = useRef<ObservedSize | null>(null);

	// Plain, stable callback (not an Effect Event) so it's safe to hand to
	// useDebouncedCallback - Effect Events must only be called from this
	// hook's own effects, never passed into another hook.
	const measurementConfigRef = useRef({ round, onResize });

	useLayoutEffect(() => {
		measurementConfigRef.current = { round, onResize };
	});

	const applyMeasurement = useCallback(
		(nextSize: ObservedSize, nextEntry: ResizeObserverEntry | undefined) => {
			const { round: shouldRound, onResize: onResizeCb } =
				measurementConfigRef.current;

			const rounded =
				shouldRound ?
					{
						width: Math.round(nextSize.width),
						height: Math.round(nextSize.height),
					}
				:	nextSize;

			const changed =
				!lastSizeRef.current || !sizesEqual(lastSizeRef.current, rounded);

			if (changed) {
				lastSizeRef.current = rounded;
				setSize(rounded);
				setEntry(nextEntry);
			}

			onResizeCb?.(rounded, nextEntry);
		},
		[],
	);

	const { debouncedFunc: debouncedApplyMeasurement } = useDebouncedCallback(
		applyMeasurement,
		debounceMs,
	);

	// Effect Event: only ever called from the ResizeObserver/resize-listener
	// callbacks set up inside this hook's own useLayoutEffect below, so it's
	// safe to omit debounceMs/debouncedApplyMeasurement/applyMeasurement from
	// that effect's dependency array without a stale closure.
	const commitMeasurement = useEffectEvent(
		(nextSize: ObservedSize, entry: ResizeObserverEntry | undefined) => {
			if (debounceMs > 0) {
				debouncedApplyMeasurement(nextSize, entry);
			} else {
				applyMeasurement(nextSize, entry);
			}
		},
	);

	useLayoutEffect(() => {
		if (!activeTarget || !enabled) return;
		if (typeof ResizeObserver === "undefined") return;

		if (activeTarget instanceof Window) {
			const handleWindowResize = () => {
				commitMeasurement(readWindowSize(), undefined);
			};

			handleWindowResize();
			activeTarget.addEventListener("resize", handleWindowResize, {
				passive: true,
			});

			return () =>
				activeTarget.removeEventListener("resize", handleWindowResize);
		}

		const element = resolveObservableElement(activeTarget);

		if (!element) return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[entries.length - 1];

			if (!entry) return;

			commitMeasurement(readBoxSize(entry, box), entry);
		});

		observer.observe(element, { box });

		return () => observer.disconnect();
	}, [activeTarget, box, enabled]);

	return {
		ref,
		width: size.width,
		height: size.height,
		entry,
	};
}

export { useResizeObserver };
