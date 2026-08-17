import { SCROLLING_DEBOUNCE_MS } from "../../shared/virtualShared/constants.ts";

/**
 * Default number of extra rows rendered beyond each edge of the visible
 * range in {@link useVirtualGrid} - see `overscanRows` on
 * {@link UseVirtualGridOptions}.
 *
 * @defaultValue 3
 */
const DEFAULT_OVERSCAN_ROWS = 3;

/**
 * Default number of extra columns rendered beyond each edge of the visible
 * range in {@link useVirtualGrid} - see `overscanCols` on
 * {@link UseVirtualGridOptions}.
 *
 * @defaultValue 3
 */
const DEFAULT_OVERSCAN_COLS = 3;

export { DEFAULT_OVERSCAN_COLS, DEFAULT_OVERSCAN_ROWS, SCROLLING_DEBOUNCE_MS };
