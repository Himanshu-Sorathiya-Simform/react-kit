type ScrollAlign = "start" | "center" | "end" | "auto";

interface ScrollToIndexOptions {
	align?: ScrollAlign;
	smooth?: boolean;
}

interface ScrollToOffsetOptions {
	smooth?: boolean;
}
interface VirtualItem {
	index: number;
	size: number;
	start: number;
}
interface UseVirtualListOptions {
	count: number;
	estimateSize: number | ((index: number) => number);
	getScrollElement: () => HTMLElement | Window | Document | null;
	overscan?: number;
	horizontal?: boolean;
	reverse?: boolean;
	scrollingDelay?: number;
}

export type {
	ScrollAlign,
	ScrollToIndexOptions,
	ScrollToOffsetOptions,
	UseVirtualListOptions,
	VirtualItem,
};
