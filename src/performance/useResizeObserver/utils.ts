import type {
	ObservedSize,
	ResizeObserverTargetElement,
	UseResizeObserverOptions,
} from "./types";

/** Resolves any {@link ResizeObserverTargetInput} shape down to a plain element/Document/Window/null. */
function resolveTarget(
	input: UseResizeObserverOptions["target"],
): ResizeObserverTargetElement | null {
	if (!input) return null;
	if (typeof input === "function") return input();
	if ("current" in input) return input.current;

	return input;
}

/** `ResizeObserver.observe()` only accepts an `Element`, so `Document` targets are mapped to their scrolling element. */
function resolveObservableElement(target: Document | Element): Element | null {
	if (target instanceof Document) {
		return target.scrollingElement ?? target.documentElement;
	}

	return target;
}

/** Extracts a width/height pair from an entry for the requested box model, falling back gracefully on older browsers. */
function readBoxSize(
	entry: ResizeObserverEntry,
	box: NonNullable<UseResizeObserverOptions["box"]>,
): ObservedSize {
	if (box === "border-box") {
		const size = entry.borderBoxSize?.[0];

		if (size) return { width: size.inlineSize, height: size.blockSize };
	}

	if (box === "device-pixel-content-box") {
		const size = entry.devicePixelContentBoxSize?.[0];

		if (size) return { width: size.inlineSize, height: size.blockSize };
	}

	// content-box, and the fallback for border-box/device-pixel-content-box
	// on browsers that don't populate those entry fields.
	const contentSize = entry.contentBoxSize?.[0];

	if (contentSize) {
		return { width: contentSize.inlineSize, height: contentSize.blockSize };
	}

	return { width: entry.contentRect.width, height: entry.contentRect.height };
}

/** `ResizeObserver` can't observe `Window` directly, so window size is read the same way `getScrollElementSize` reads it elsewhere in this library. */
function readWindowSize(): ObservedSize {
	// Matches getScrollElementSize's existing Window handling elsewhere in
	// this library: documentElement.clientWidth/Height (excludes scrollbar),
	// not window.innerWidth/innerHeight (includes it).
	return {
		width: document.documentElement.clientWidth,
		height: document.documentElement.clientHeight,
	};
}

/** Shallow width/height equality, used to skip redundant state updates and re-renders. */
function sizesEqual(a: ObservedSize, b: ObservedSize): boolean {
	return a.width === b.width && a.height === b.height;
}

export {
	readBoxSize,
	readWindowSize,
	resolveObservableElement,
	resolveTarget,
	sizesEqual,
};
