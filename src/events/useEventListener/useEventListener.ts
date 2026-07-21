import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { TargetType, UseEventListenerOptions } from "./types.ts";

const useIsomorphicLayoutEffect =
	typeof window !== "undefined" ? useLayoutEffect : useEffect;

type UseEventListenerReturn = void;

function useEventListener<K extends keyof WindowEventMap>(
	eventName: K | K[],
	handler: (event: WindowEventMap[K]) => void,
	options?: UseEventListenerOptions<Window> & {
		target?: Window | null | undefined;
	},
): UseEventListenerReturn;

function useEventListener<K extends keyof DocumentEventMap>(
	eventName: K | K[],
	handler: (event: DocumentEventMap[K]) => void,
	options: UseEventListenerOptions<Document> & {
		target: Document | RefObject<Document | null> | null;
	},
): UseEventListenerReturn;

function useEventListener<
	K extends keyof HTMLElementEventMap,
	T extends HTMLElement = HTMLElement,
>(
	eventName: K | K[],
	handler: (event: HTMLElementEventMap[K]) => void,
	options: UseEventListenerOptions<T> & { target: T | RefObject<T | null> | null },
): UseEventListenerReturn;

function useEventListener<
	K extends keyof SVGElementEventMap,
	T extends SVGElement = SVGElement,
>(
	eventName: K | K[],
	handler: (event: SVGElementEventMap[K]) => void,
	options: UseEventListenerOptions<T> & { target: T | RefObject<T | null> | null },
): UseEventListenerReturn;

function useEventListener<K extends string, T extends TargetType = TargetType>(
	eventName: K | K[],
	handler: (event: Event) => void,
	options: UseEventListenerOptions<T> & { target: T | RefObject<T | null> | null },
): UseEventListenerReturn;

function useEventListener(
	eventName: string | string[],
	handler: (event: Event) => void,
	options: UseEventListenerOptions<TargetType> = {},
): UseEventListenerReturn {
	const { target, capture = false, passive = false, once = false } = options;
	const resolvedTarget =
		target === undefined ?
			typeof window === "undefined" ?
				null
			:	window
		:	target;

	const savedHandler = useRef(handler);

	useIsomorphicLayoutEffect(() => {
		savedHandler.current = handler;
	}, [handler]);

	const eventNamesStr = Array.isArray(eventName) ? eventName.join(",") : eventName;

	useEffect(() => {
		const targetElement =
			resolvedTarget && "current" in resolvedTarget ?
				resolvedTarget.current
			:	resolvedTarget;

		if (!targetElement?.addEventListener) {
			return;
		}

		const eventNames = Array.isArray(eventName) ? eventName : [eventName];
		const listener: typeof handler = (event) => savedHandler.current(event);

		eventNames.forEach((event) => {
			targetElement.addEventListener(event, listener, {
				capture,
				passive,
				once,
			});
		});

		return () => {
			eventNames.forEach((event) => {
				targetElement.removeEventListener(event, listener, { capture });
			});
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [eventNamesStr, resolvedTarget, capture, passive, once]);
}

export { type UseEventListenerReturn, useEventListener };
