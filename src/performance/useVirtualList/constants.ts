import { SCROLLING_DEBOUNCE_MS } from "../../shared/virtualShared/constants.ts";

/**
 * Default number of extra items rendered beyond each edge of the visible
 * range in {@link useVirtualList} - see `overscan` on
 * {@link UseVirtualListOptions}.
 *
 * @defaultValue 3
 */
const DEFAULT_OVERSCAN = 3;

export { DEFAULT_OVERSCAN, SCROLLING_DEBOUNCE_MS };
