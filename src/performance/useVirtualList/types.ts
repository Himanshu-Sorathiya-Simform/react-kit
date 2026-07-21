import type { Key } from "react";

type ScrollAlign = "start" | "center" | "end" | "auto";

interface ScrollToIndexOptions {
	align?: ScrollAlign;
	smooth?: boolean;
}

interface ScrollToOffsetOptions {
	smooth?: boolean;
}

interface VirtualItem {
	key: Key;
	index: number;
	size: number;
	start: number;
}

interface UseVirtualListOptions<T = unknown> {
	count: number;
	estimateSize: number | ((index: number) => number);
	getScrollElement: () => HTMLElement | Window | Document | null;
	overscan?: number;
	horizontal?: boolean;
	reverse?: boolean;
	scrollingDelay?: number;
	initialViewportSize?: number;
	initialOffset?: number;
	initialScrollIndex?: number;
	data?: T[];
	itemKey?: string | string[] | ((index: number, item?: T) => Key);
}

export type {
	ScrollAlign,
	ScrollToIndexOptions,
	ScrollToOffsetOptions,
	UseVirtualListOptions,
	VirtualItem,
};
