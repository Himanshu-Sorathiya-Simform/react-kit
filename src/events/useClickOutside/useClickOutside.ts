import { useEffect, useLayoutEffect, useRef } from "react";
import { useEventListener } from "../useEventListener/useEventListener.ts";
import type {
	ClickOutsideEvent,
	ClickOutsideTargetRef,
	UseClickOutsideOptions,
} from "./types.ts";

const useIsomorphicLayoutEffect =
	typeof window !== "undefined" ? useLayoutEffect : useEffect;

type UseClickOutsideReturn = void;

function useClickOutside(
	target: ClickOutsideTargetRef | ClickOutsideTargetRef[],
	handler: (event: ClickOutsideEvent) => void,
	options: UseClickOutsideOptions = {},
): UseClickOutsideReturn {
	const { enabled = true, eventType = ["mousedown", "touchstart"] } = options;

	const savedHandler = useRef(handler);

	useIsomorphicLayoutEffect(() => {
		savedHandler.current = handler;
	}, [handler]);

	const eventListener = (event: Event) => {
		if (!enabled) return;

		const targets = Array.isArray(target) ? target : [target];

		const isOutside = targets.every((t) => {
			const el = t && "current" in t ? t.current : t;
			return el && !el.contains(event.target as Node);
		});

		if (isOutside) {
			savedHandler.current(event as ClickOutsideEvent);
		}
	};

	useEventListener(eventType, eventListener, {
		target: typeof document === "undefined" ? null : document,
	});
}

export { type UseClickOutsideReturn, useClickOutside };
