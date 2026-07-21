import type { RefObject } from "react";

type TargetType = EventTarget;

type TargetRef<T extends TargetType> = RefObject<T | null> | T | null;

interface UseEventListenerOptions<
	T extends TargetType,
> extends AddEventListenerOptions {
	target?: TargetRef<T>;
}

export type { TargetRef, TargetType, UseEventListenerOptions };
