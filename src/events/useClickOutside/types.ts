import type { RefObject } from "react";

type ClickOutsideEvent = MouseEvent | TouchEvent | PointerEvent | Event;

type ClickOutsideTarget = HTMLElement | null;

type ClickOutsideTargetRef = RefObject<ClickOutsideTarget> | ClickOutsideTarget;

interface UseClickOutsideOptions {
	enabled?: boolean;
	eventType?: string | string[];
}

export type {
	ClickOutsideEvent,
	ClickOutsideTarget,
	ClickOutsideTargetRef,
	UseClickOutsideOptions,
};
