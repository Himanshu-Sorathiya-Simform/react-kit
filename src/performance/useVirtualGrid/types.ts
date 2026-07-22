import type { Key } from "react";
import type { ScrollAlign, ScrollToOffsetOptions } from "../virtualShared/types.ts";

interface ScrollToCellOptions {
	rowAlign?: ScrollAlign;
	colAlign?: ScrollAlign;
	smooth?: boolean;
}

interface ScrollToRowOptions {
	align?: ScrollAlign;
	smooth?: boolean;
}

interface ScrollToColumnOptions {
	align?: ScrollAlign;
	smooth?: boolean;
}

interface VirtualCell {
	key: Key;
	rowIndex: number;
	colIndex: number;
	height: number;
	width: number;
	top: number;
	left: number;
}

interface UseVirtualGridOptions {
	rowCount: number;
	colCount: number;
	estimateRowHeight: number | ((rowIndex: number) => number);
	estimateColumnWidth: number | ((colIndex: number) => number);
	getScrollElement: () => HTMLElement | Window | Document | null;
	overscanRows?: number;
	overscanCols?: number;
	scrollingDelay?: number;
	initialViewportHeight?: number;
	initialViewportWidth?: number;
	initialScrollTop?: number;
	initialScrollLeft?: number;
	initialScrollRow?: number;
	initialScrollCol?: number;
	itemKey?: (rowIndex: number, colIndex: number) => Key;
}

export type {
	ScrollAlign,
	ScrollToCellOptions,
	ScrollToColumnOptions,
	ScrollToOffsetOptions,
	ScrollToRowOptions,
	UseVirtualGridOptions,
	VirtualCell,
};
