import type { ObservedSize } from "./types";

/** Shared default so unmeasured hooks don't allocate a fresh `{width:0,height:0}` object per render. */
const EMPTY_SIZE: ObservedSize = { width: 0, height: 0 };

export { EMPTY_SIZE };
