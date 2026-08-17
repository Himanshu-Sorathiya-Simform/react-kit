/**
 * How `scrollToIndex`/`scrollToOffset` (and the equivalent
 * row/column/cell methods on `useVirtualGrid`) position a target item
 * relative to the viewport.
 *
 * @remarks
 * - `"start"` - align the item's leading edge with the viewport's leading edge.
 * - `"end"` - align the item's trailing edge with the viewport's trailing edge.
 * - `"center"` - center the item within the viewport.
 * - `"auto"` - do nothing if the item is already fully visible; otherwise
 *   scroll the minimum distance needed to bring it fully into view.
 *
 * For `reverse` lists, `"start"`/`"end"` are relative to the *logical*
 * reading direction (which visually flips), not the physical viewport -
 * `"auto"` always minimizes physical scroll distance regardless of
 * `reverse`, since "nearest" is a physical-space concept.
 */
type ScrollAlign = "start" | "center" | "end" | "auto";

/** Which scroll direction a size, offset, or measurement refers to. */
type Axis = "vertical" | "horizontal";

/** Options shared by the imperative `scrollTo*` methods across the virtualization hooks. */
interface ScrollToOffsetOptions {
	/**
	 * Use smooth (animated) scrolling instead of an instant jump.
	 *
	 * @defaultValue `false`
	 */
	smooth?: boolean;
}

export type { Axis, ScrollAlign, ScrollToOffsetOptions };
