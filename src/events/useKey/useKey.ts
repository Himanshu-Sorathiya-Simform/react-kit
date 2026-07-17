import { useEffect, useLayoutEffect, useRef } from "react";
import { validKeyEventTypes } from "./constants.ts";
import type { KeyOptions } from "./types.ts";

type UseKeyReturn = void;

function useKey(
	key: string,
	handler: (e: KeyboardEvent) => void,
	{
		enabled = true,
		preventDefault = true,
		stopPropagation = true,
		eventType = "keydown",
		preventRepeat = false,
		ignoreWhenFocusedInInputs = true,
		ctrlKey = false,
		shiftKey = false,
		altKey = false,
		metaKey = false,
		target = window,
	}: KeyOptions = {},
): UseKeyReturn {
	const funcRef = useRef(handler);
	const enabledRef = useRef(enabled);
	const hasFiredRef = useRef(false);

	useLayoutEffect(() => {
		funcRef.current = handler;
	}, [handler]);

	useEffect(() => {
		enabledRef.current = enabled;
	}, [enabled]);

	useEffect(() => {
		const targetElement =
			target && "current" in target ? target.current : target;

		if (!targetElement) return;

		const targetKey = String(key || "").toLowerCase();

		const resolvedEventType =
			validKeyEventTypes.includes(eventType) ? eventType : "keydown";

		const shouldPreventRepeat = preventRepeat && resolvedEventType !== "keyup";

		function handleBlur() {
			hasFiredRef.current = false;
		}

		function handleKeyUp(e: Event) {
			if (!(e instanceof KeyboardEvent)) return;

			const releasedKey = e.key.toLowerCase();

			if (
				releasedKey === targetKey
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
				ignoreWhenFocusedInInputs
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

			if (matchesModifiers && targetKey === e.key.toLowerCase()) {
				if (shouldPreventRepeat && hasFiredRef.current) return;
				hasFiredRef.current = true;

				funcRef.current(e);

				if (preventDefault) e.preventDefault();
				if (stopPropagation) e.stopPropagation();
			}
		}

		targetElement.addEventListener(resolvedEventType, handleKeyEvent);

		if (shouldPreventRepeat) {
			targetElement.addEventListener("keyup", handleKeyUp);
			window.addEventListener("blur", handleBlur);
		}

		return () => {
			targetElement.removeEventListener(resolvedEventType, handleKeyEvent);

			if (shouldPreventRepeat) {
				targetElement.removeEventListener("keyup", handleKeyUp);
				window.removeEventListener("blur", handleBlur);
			}
		};
	}, [
		key,
		preventDefault,
		stopPropagation,
		eventType,
		preventRepeat,
		ignoreWhenFocusedInInputs,
		ctrlKey,
		shiftKey,
		altKey,
		metaKey,
		target,
	]);
}

export { type UseKeyReturn, useKey };
