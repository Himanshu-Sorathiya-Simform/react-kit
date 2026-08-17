import type { RefObject } from "react";

/**
 * Which CSS box model {@link useResizeObserver} measures.
 *
 * @remarks
 * Mirrors the `box` option of the native
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver/observe | ResizeObserver.observe()}
 * method:
 * - `"content-box"` - padding and border excluded. The default, and what
 *   most layout code expects (matches `element.clientWidth`/`clientHeight`
 *   roughly, modulo scrollbars).
 * - `"border-box"` - padding and border included (matches
 *   `getBoundingClientRect()` for elements without CSS transforms).
 * - `"device-pixel-content-box"` - content-box, but in physical device
 *   pixels rather than CSS pixels. Useful for pixel-perfect canvas/WebGL
 *   sizing on high-DPI screens. Falls back to `"content-box"` on browsers
 *   that don't populate this field on the observer entry.
 *
 * Ignored when the observed target is a `Window` - see {@link ResizeObserverTargetElement}.
 */
type ResizeObserverBox = "border-box" | "content-box" | "device-pixel-content-box";

/**
 * Anything {@link useResizeObserver} can observe: `Element` for a normal DOM
 * node, or `Document`/`Window` for whole-page sizing (both fall back to
 * `document.documentElement`'s `clientWidth`/`clientHeight` internally,
 * since `ResizeObserver` itself can only `observe()` an `Element`).
 */
type ResizeObserverTargetElement = Document | Element | Window;

/**
 * How to tell {@link useResizeObserver} what to observe.
 *
 * @remarks
 * Four shapes are accepted, matching the `getScrollElement`-style
 * convention used elsewhere in this library:
 * - **omitted / `undefined`** - ref-callback mode. Attach the hook's
 *   returned `ref` to your own JSX element.
 * - **`null`** - explicitly disabled; nothing is observed regardless of
 *   `enabled`.
 * - **an element, `Document`, or `Window`** - observe it directly.
 * - **a `RefObject` or a getter function** (`() => ResizeObserverTargetElement | null`)
 *   - resolved on every render, so it's safe to pass e.g. `() => scrollRef.current`
 *   without memoizing it.
 */
type ResizeObserverTargetInput =
	| ResizeObserverTargetElement
	| RefObject<ResizeObserverTargetElement | null>
	| (() => ResizeObserverTargetElement | null)
	| null;

/** A measured width/height pair, in CSS pixels (or device pixels - see {@link ResizeObserverBox}). */
interface ObservedSize {
	width: number;
	height: number;
}

/** Options for {@link useResizeObserver}. */
interface UseResizeObserverOptions {
	/**
	 * External target to observe.
	 *
	 * @defaultValue `undefined` (ref-callback mode - see {@link ResizeObserverTargetInput})
	 */
	target?: ResizeObserverTargetInput;

	/**
	 * Which box model to measure. Ignored when the target is a `Window`.
	 *
	 * @defaultValue `"content-box"`
	 */
	box?: ResizeObserverBox;

	/**
	 * Pause observing without unmounting - the last measured `width`/`height`
	 * is retained, just no longer updated.
	 *
	 * @defaultValue `true`
	 */
	enabled?: boolean;

	/**
	 * Round `width`/`height` to whole pixels before updating state. Useful
	 * because `ResizeObserver` can fire on sub-pixel changes, which is
	 * usually more precision than layout code needs and causes more
	 * re-renders than necessary.
	 *
	 * @defaultValue `false`
	 */
	round?: boolean;

	/**
	 * Debounce measurement updates by this many milliseconds. `0` applies
	 * every measurement immediately (still batched by the browser's native
	 * `ResizeObserver` delivery, just not further delayed by this hook).
	 *
	 * @defaultValue `0`
	 */
	debounceMs?: number;

	/**
	 * Value returned before the first real measurement resolves. Useful for
	 * avoiding a `{ width: 0, height: 0 }` flash when you already know an
	 * element's rough starting size (e.g. from a CSS `min-height`).
	 *
	 * @defaultValue `{ width: 0, height: 0 }`
	 */
	initialSize?: ObservedSize;

	/**
	 * Imperative callback fired on every measurement update, in addition to
	 * (not instead of) the hook's returned `width`/`height` state updating.
	 * Useful for side effects that don't need a re-render, like redrawing a
	 * canvas.
	 *
	 * @param size - The newly measured (and possibly rounded) size.
	 * @param entry - The raw `ResizeObserverEntry`, or `undefined` when the
	 * target is a `Window` (which has no entry, since it's measured via the
	 * native `resize` event rather than `ResizeObserver`).
	 */
	onResize?: (size: ObservedSize, entry: ResizeObserverEntry | undefined) => void;
}

export type {
	ObservedSize,
	ResizeObserverBox,
	ResizeObserverTargetElement,
	ResizeObserverTargetInput,
	UseResizeObserverOptions,
};
