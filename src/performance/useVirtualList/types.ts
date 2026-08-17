import type {
	ScrollAlign,
	ScrollToOffsetOptions,
} from "../../shared/virtualShared/types.ts";

/** Options for {@link useVirtualList}'s `scrollToIndex` method. */
interface ScrollToIndexOptions {
	/**
	 * How to position the target item relative to the viewport.
	 *
	 * @defaultValue `"auto"`
	 */
	align?: ScrollAlign;

	/**
	 * Use smooth (animated) scrolling instead of an instant jump.
	 *
	 * @defaultValue `false`
	 */
	smooth?: boolean;
}

/** A single rendered item, as produced by {@link useVirtualList}'s `virtualItems`. */
interface VirtualItem {
	/**
	 * A stable React key for this item - derived from `itemKey` if
	 * provided, otherwise falls back to `index`.
	 */
	key: string | number;

	/** This item's position in the full (un-virtualized) list. */
	index: number;

	/** This item's size along the scrolling axis (height for vertical lists, width for horizontal). */
	size: number;

	/**
	 * This item's start position along the scrolling axis, relative to the
	 * top/left of the virtualized content (i.e. excluding `scrollMargin`) -
	 * typically consumed as a `transform: translateY(start)` (or
	 * `translateX` for horizontal lists).
	 */
	start: number;

	/** `start + size` - this item's end position, provided for convenience. */
	end: number;
}

/** The currently-rendered index range, as produced by {@link useVirtualList}'s `onRangeChange`. */
interface VirtualRange {
	/** Numerically lowest rendered index (inclusive), overscan included. */
	startIndex: number;
	/** Numerically highest rendered index (inclusive), overscan included. */
	endIndex: number;
}

/** Customizes what "visible" means for the `pauseWhenOffscreen` option - see {@link UseVirtualListOptions.pauseWhenOffscreen}. */
interface PauseWhenOffscreenConfig {
	/**
	 * The element used as the viewport when checking whether the scroll
	 * container is visible.
	 *
	 * @defaultValue `null` (the nearest scrollable ancestor / browser viewport, per `IntersectionObserver`'s native `root` behavior)
	 */
	root?: Element | Document | null;

	/**
	 * Margin added around `root`'s bounding box before checking visibility,
	 * in CSS `margin` shorthand syntax - e.g. `"200px"` to keep tracking
	 * active slightly before the list is actually on screen.
	 *
	 * @defaultValue `"0px"`
	 */
	rootMargin?: string;
}

/** Options for {@link useVirtualList}. */
interface UseVirtualListOptions<T = unknown> {
	/** Total number of items in the full (un-virtualized) list. */
	count: number;

	/**
	 * Each item's size along the scrolling axis - a constant applied to
	 * every item, or a function called per-index.
	 *
	 * @remarks
	 * When a function is used and `measureElement` isn't attached to your
	 * rendered items, this is treated as a fixed size (not just an initial
	 * estimate) - attach `measureElement` if you want actual rendered sizes
	 * to refine it over time.
	 *
	 * A function `estimateSize` is memoized internally keyed on its own
	 * reference identity - passing a new inline function every render (e.g.
	 * `estimateSize={(i) => 50}` written directly in JSX/hook options,
	 * rather than a `useCallback`-wrapped or module-level function) rebuilds
	 * the entire internal size cache on every render, which defeats the
	 * point of caching. Memoize it if it's not already stable.
	 */
	estimateSize: number | ((index: number) => number);

	/**
	 * Returns the scrollable element to track - called fresh on every
	 * render, so it's safe to pass e.g. `() => scrollRef.current` without
	 * memoizing it. Return `window` or `document` to virtualize within the
	 * whole page's own scroll, instead of a dedicated scrollable container.
	 */
	getScrollElement: () => HTMLElement | Window | Document | null;

	/**
	 * Extra items rendered beyond each edge of the visible range, to reduce
	 * blank flashes during fast scrolling and give browsers a head start on
	 * things like image decoding.
	 *
	 * @defaultValue `3`
	 */
	overscan?: number;

	/**
	 * Scroll and measure along the horizontal axis (`scrollLeft`/width)
	 * instead of the default vertical axis (`scrollTop`/height).
	 *
	 * @defaultValue `false`
	 */
	horizontal?: boolean;

	/**
	 * Render items in reverse physical order - index `0` at the visual
	 * bottom/trailing end, `count - 1` at the visual top/leading end (the
	 * indices themselves don't change, only where each one is positioned).
	 * Suited to chat-style UIs. See {@link ScrollAlign} for how this
	 * interacts with alignment.
	 *
	 * @defaultValue `false`
	 */
	reverse?: boolean;

	/**
	 * RTL horizontal scrolling. Only meaningful when `horizontal` is `true`.
	 * Uses the modern (negative `scrollLeft`) convention - not
	 * cross-browser verified.
	 *
	 * @defaultValue `false`
	 */
	isRtl?: boolean;

	/**
	 * Space between consecutive items along the scrolling axis. Not added
	 * after the last item.
	 *
	 * @defaultValue `0`
	 */
	gap?: number;

	/**
	 * Distance this list's content starts from the top (or left, if
	 * `horizontal`) of a shared scroll container - e.g. page content above
	 * it when using Window/Document scrolling.
	 *
	 * @defaultValue `0`
	 */
	scrollMargin?: number;

	/**
	 * Pause scroll/resize tracking without unmounting. Virtual items freeze
	 * at their last computed state rather than going blank.
	 *
	 * @defaultValue `true`
	 */
	enabled?: boolean;

	/**
	 * Also pause scroll/resize tracking whenever the scroll element itself
	 * isn't visible on screen (e.g. a hidden tab panel, or far down a long
	 * page) - `true` for defaults, or a {@link PauseWhenOffscreenConfig} to
	 * customize the `IntersectionObserver` `root`/`rootMargin` used to
	 * decide "visible". Has no effect when `getScrollElement` returns
	 * `Window`/`Document`, since a whole-page scroller has no meaningful
	 * "offscreen" state of its own.
	 *
	 * @defaultValue `false` (opt-in, since it adds an observer)
	 */
	pauseWhenOffscreen?: boolean | PauseWhenOffscreenConfig;

	/**
	 * How long scrolling must stay idle before `isScrolling` flips back to
	 * `false`. `0` (or any non-positive value) resolves `isScrolling` to
	 * `false` immediately on the next scroll-idle check, rather than
	 * disabling `isScrolling` tracking altogether.
	 *
	 * @defaultValue `150`
	 */
	scrollingDelay?: number;

	/**
	 * Assumed viewport size before the scroll container has been measured
	 * (e.g. during SSR, or the first client render before layout runs).
	 * Also used as a fallback if a live measurement ever comes back `0`.
	 *
	 * @defaultValue `0`
	 */
	initialViewportSize?: number;

	/**
	 * Scroll to this offset on mount, before the first paint. Takes
	 * priority over `initialScrollIndex` if both are set.
	 */
	initialOffset?: number;

	/** Scroll so this index is visible on mount, before the first paint. Ignored if `initialOffset` is also set. */
	initialScrollIndex?: number;

	/**
	 * How `initialScrollIndex` is aligned within the viewport. Only used
	 * together with `initialScrollIndex`.
	 *
	 * @defaultValue `"start"`
	 */
	initialScrollAlign?: ScrollAlign;

	/**
	 * When `measureElement` reports a size for an item positioned before
	 * the current viewport, adjust `scrollOffset` by the same delta so
	 * already-visible content doesn't visually jump.
	 *
	 * @defaultValue `true`
	 */
	adjustScrollOnMeasure?: boolean;

	/** Backing data array, used together with a string/string-array `itemKey` to derive each item's key. Not required when `itemKey` is a function, or when omitting `itemKey` entirely (falls back to `index` as the key). */
	data?: T[];

	/**
	 * How to derive each rendered item's React `key`.
	 *
	 * @remarks
	 * Accepts three shapes:
	 * - a **function** `(index, item?) => key` - called with the index and
	 *   (if `data` is provided) that index's item; return value used
	 *   directly.
	 * - a **string** - a property path into `data[index]`, dot-separated
	 *   for nested access (e.g. `"name.firstName"` reads `data[index].name.firstName`).
	 * - a **string array** - the same path, pre-split into segments (e.g.
	 *   `["name", "firstName"]`), useful when a real key name itself
	 *   contains a literal dot.
	 *
	 * Falls back to `index` if `data` is missing, the resolved value isn't
	 * a `string`/`number`, or `itemKey` is omitted entirely. Using a stable
	 * value derived from your data (rather than the default `index`) is
	 * recommended whenever items can be inserted, removed, or reordered.
	 */
	itemKey?: string | string[] | ((index: number, item?: T) => string | number);

	/**
	 * Called whenever the rendered index range actually changes (not on
	 * every render). Useful for analytics, or triggering data-fetching from
	 * outside the hook.
	 */
	onRangeChange?: (range: VirtualRange) => void;
}

export type {
	PauseWhenOffscreenConfig,
	ScrollAlign,
	ScrollToIndexOptions,
	ScrollToOffsetOptions,
	UseVirtualListOptions,
	VirtualItem,
	VirtualRange,
};
