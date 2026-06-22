/* eslint-disable @typescript-eslint/no-explicit-any */

import { type RefObject, useEffect, useRef } from "react";
import { validKeyEventTypes } from "../constants/keyConstants.ts";

type KeyEventType = (typeof validKeyEventTypes)[number];

interface KeyLifecycleOptions {
	enabled?: boolean;
	target?: RefObject<HTMLElement | null> | Window;
}

interface KeyEventModifiers {
	preventDefault?: boolean;
	stopPropagation?: boolean;
	eventType?: KeyEventType;
}

interface KeyChordModifiers {
	ctrlKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
	metaKey?: boolean;
}

interface KeyFilterOptions {
	requireReset?: boolean;
	ignoreInputs?: boolean;
}

interface KeyOptions
	extends
		KeyLifecycleOptions,
		KeyEventModifiers,
		KeyChordModifiers,
		KeyFilterOptions {}

type UseKeyReturn = void;

function useKey(
	key: string,
	func: (...args: any[]) => void,
	{
		enabled = true,
		preventDefault = true,
		stopPropagation = true,
		eventType = "keydown",
		requireReset = false,
		ignoreInputs = true,
		ctrlKey = false,
		shiftKey = false,
		altKey = false,
		metaKey = false,
		target = window,
	}: KeyOptions = {},
): UseKeyReturn {
	const funcRef = useRef(func);
	const enabledRef = useRef(enabled);
	const hasFiredRef = useRef(false);

	const targetElement =
		(target && "current" in target && target.current) || window;

	useEffect(() => {
		funcRef.current = func;
	}, [func]);

	useEffect(() => {
		enabledRef.current = enabled;
	}, [enabled]);

	useEffect(() => {
		if (!targetElement) return;

		const resolvedEventType =
			validKeyEventTypes.includes(eventType) ? eventType : "keydown";

		function handleKeyUp(e: Event) {
			if (!(e instanceof KeyboardEvent)) return;

			const releasedKey = e.key.toLowerCase();

			if (
				releasedKey === key.toLowerCase()
				|| (ctrlKey && releasedKey === "control")
				|| (shiftKey && releasedKey === "shift")
				|| (altKey && releasedKey === "alt")
				|| (metaKey && releasedKey === "meta")
			) {
				hasFiredRef.current = false;
			}
		}

		function handleKeyEvent(e: Event) {
			if (!(e instanceof KeyboardEvent) || !enabledRef.current) return;

			const activeElement = e.target;

			if (
				ignoreInputs
				&& activeElement instanceof HTMLElement
				&& (activeElement instanceof HTMLInputElement
					|| activeElement instanceof HTMLTextAreaElement
					|| activeElement instanceof HTMLSelectElement
					|| activeElement.isContentEditable)
			)
				return;

			const matchesModifiers =
				e.ctrlKey === ctrlKey
				&& e.shiftKey === shiftKey
				&& e.altKey === altKey
				&& e.metaKey === metaKey;

			if (matchesModifiers && key.toLowerCase() === e.key.toLowerCase()) {
				if (requireReset && hasFiredRef.current) return;
				hasFiredRef.current = true;

				funcRef.current(e);

				if (preventDefault) e.preventDefault();
				if (stopPropagation) e.stopPropagation();
			}
		}

		targetElement.addEventListener(resolvedEventType, handleKeyEvent);
		targetElement.addEventListener("keyup", handleKeyUp);

		return () => {
			targetElement.removeEventListener(resolvedEventType, handleKeyEvent);
			targetElement.removeEventListener("keyup", handleKeyUp);
		};
	}, [
		key,
		preventDefault,
		stopPropagation,
		eventType,
		requireReset,
		ignoreInputs,
		ctrlKey,
		shiftKey,
		altKey,
		metaKey,
		targetElement,
	]);
}

export {
	type KeyChordModifiers,
	type KeyEventModifiers,
	type KeyEventType,
	type KeyFilterOptions,
	type KeyLifecycleOptions,
	type KeyOptions,
	type UseKeyReturn,
	useKey,
};
