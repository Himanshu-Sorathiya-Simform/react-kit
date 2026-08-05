import {
	type RefObject,
	useCallback,
	useEffect,
	useEffectEvent,
	useRef,
} from "react";
import type { TargetType, UseEventListenerOptions } from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * A function that detaches the listener(s) registered by `useEventListener`
 * immediately, without waiting for the component to unmount.
 *
 * Safe to call more than once — it's a no-op after the first call. Note
 * that this does not permanently disable the hook: if its dependencies
 * (event name(s), target, `capture`, `passive`, `once`, or `signal`) change
 * afterwards, a new listener may be attached again on the next render.
 */
type UseEventListenerReturn = () => void;

/**
 * Listens for one or more events on `window` — the default target when none
 * is specified.
 *
 * @param eventName A single event name, or an array of event names, to listen for.
 * @param handler Called with the native event whenever it fires. Doesn't need to be
 * memoized — the latest `handler` is always used, and changing it does not
 * re-attach the listener.
 * @param options Optional. `target` may be omitted (defaults to `window`), or set
 * explicitly to `window` or `null` (to disable).
 * @returns A function that detaches the listener(s) on demand.
 *
 * @example
 * ```tsx
 * useEventListener("resize", () => {
 *   console.log(window.innerWidth);
 * });
 * ```
 */
function useEventListener<K extends keyof WindowEventMap>(
	eventName: K | K[],
	handler: (event: WindowEventMap[K]) => void,
	options?: UseEventListenerOptions<Window> & {
		target?: Window | null | undefined;
	},
): UseEventListenerReturn;

/**
 * Listens for one or more events on `document`. `target` is required to
 * distinguish this overload from the `window` one.
 *
 * @param eventName A single event name, or an array of event names, to listen for.
 * @param handler Called with the native event whenever it fires. Doesn't need to be
 * memoized — the latest `handler` is always used, and changing it does not
 * re-attach the listener.
 * @param options `target` must be `document`, a ref pointing at `document`, or `null`
 * (to disable).
 * @returns A function that detaches the listener(s) on demand.
 *
 * @example
 * ```tsx
 * useEventListener("visibilitychange", () => {
 *   console.log(document.visibilityState);
 * }, { target: document });
 * ```
 */
function useEventListener<K extends keyof DocumentEventMap>(
	eventName: K | K[],
	handler: (event: DocumentEventMap[K]) => void,
	options: UseEventListenerOptions<Document> & {
		target: Document | RefObject<Document | null> | null;
	},
): UseEventListenerReturn;

/**
 * Listens for one or more events on an `HTMLElement`, via a ref or the
 * element itself.
 *
 * @param eventName A single event name, or an array of event names, to listen for.
 * @param handler Called with the native event whenever it fires. Doesn't need to be
 * memoized — the latest `handler` is always used, and changing it does not
 * re-attach the listener.
 * @param options `target` must be the element, a ref to it, or `null` (to disable —
 * for example while the ref hasn't attached to a DOM node yet).
 * @returns A function that detaches the listener(s) on demand.
 *
 * @example
 * ```tsx
 * const buttonRef = useRef<HTMLButtonElement>(null);
 * useEventListener("click", () => {
 *   console.log("clicked");
 * }, { target: buttonRef });
 * ```
 */
function useEventListener<
	K extends keyof HTMLElementEventMap,
	T extends HTMLElement = HTMLElement,
>(
	eventName: K | K[],
	handler: (event: HTMLElementEventMap[K]) => void,
	options: UseEventListenerOptions<T> & { target: T | RefObject<T | null> | null },
): UseEventListenerReturn;

/**
 * Listens for one or more events on an `SVGElement`, via a ref or the
 * element itself.
 *
 * @param eventName A single event name, or an array of event names, to listen for.
 * @param handler Called with the native event whenever it fires. Doesn't need to be
 * memoized — the latest `handler` is always used, and changing it does not
 * re-attach the listener.
 * @param options `target` must be the element, a ref to it, or `null` (to disable).
 * @returns A function that detaches the listener(s) on demand.
 *
 * @example
 * ```tsx
 * const circleRef = useRef<SVGCircleElement>(null);
 * useEventListener("click", () => {
 *   console.log("circle clicked");
 * }, { target: circleRef });
 * ```
 */
function useEventListener<
	K extends keyof SVGElementEventMap,
	T extends SVGElement = SVGElement,
>(
	eventName: K | K[],
	handler: (event: SVGElementEventMap[K]) => void,
	options: UseEventListenerOptions<T> & { target: T | RefObject<T | null> | null },
): UseEventListenerReturn;

/**
 * Listens for one or more events on any other `EventTarget` — a custom
 * event emitter, `ShadowRoot`, `MessagePort`, and so on. Since there's no
 * matching `*EventMap` for arbitrary targets, events are typed as the
 * generic `Event`.
 *
 * @param eventName A single event name, or an array of event names, to listen for.
 * @param handler Called with the native event whenever it fires. Doesn't need to be
 * memoized — the latest `handler` is always used, and changing it does not
 * re-attach the listener.
 * @param options `target` must be the target, a ref to it, or `null` (to disable).
 * @returns A function that detaches the listener(s) on demand.
 *
 * @example
 * ```tsx
 * useEventListener("message", (event) => {
 *   console.log(event);
 * }, { target: myMessagePort });
 * ```
 */
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
	const {
		target,
		capture = false,
		passive = false,
		once = false,
		signal: externalSignal,
	} = options;
	const resolvedTarget =
		target === undefined ?
			typeof window === "undefined" ?
				null
			:	window
		:	target;

	const onEvent = useEffectEvent(handler);

	// Reduced to a primitive so the effect's dependency array reacts to
	// actual value changes, not just array identity — this stays stable
	// even when the caller passes an unmemoized array literal every render.
	const eventNamesStr = Array.isArray(eventName) ? eventName.join(",") : eventName;

	// A ref, not a plain closure variable, so `stop()` always aborts
	// whichever controller is currently active — even after the effect
	// below has re-run for unrelated reasons and created a new one.
	const controllerRef = useRef<AbortController | null>(null);

	const stop = useCallback<UseEventListenerReturn>(() => {
		controllerRef.current?.abort();
		controllerRef.current = null;
	}, []);

	useEffect(() => {
		const eventNames = Array.isArray(eventName) ? eventName : [eventName];

		if (isDev && eventNames.length === 0) {
			console.warn(
				"[useEventListener] Called with an empty eventName array — no listeners were attached.",
			);
		}

		const targetElement =
			resolvedTarget && "current" in resolvedTarget ?
				resolvedTarget.current
			:	resolvedTarget;

		// Split into two checks on purpose. A missing target — a ref that
		// hasn't attached yet, an explicit `null`, or no `window` during SSR
		// — is a normal, common state and should stay silent. A target that
		// exists but doesn't implement addEventListener is almost always a
		// real mistake, and is worth a warning.
		if (!targetElement) {
			return;
		}

		if (!targetElement.addEventListener) {
			if (isDev) {
				console.warn(
					"[useEventListener] The resolved target does not implement addEventListener — no listener was attached.",
					targetElement,
				);
			}

			return;
		}

		// One AbortController drives cleanup for every event name registered
		// below — aborting it removes all of them in a single call, instead
		// of tracking each addEventListener/removeEventListener pair by hand.
		const controller = new AbortController();
		controllerRef.current = controller;

		// Merges our own lifecycle with any signal the caller passed in —
		// either one aborting detaches the listener(s).
		const signal =
			externalSignal ?
				AbortSignal.any([controller.signal, externalSignal])
			:	controller.signal;

		const listener: typeof handler = (event) => onEvent(event);

		eventNames.forEach((event) => {
			targetElement.addEventListener(event, listener, {
				capture,
				passive,
				once,
				signal,
			});
		});

		return () => {
			controller.abort();
			if (controllerRef.current === controller) {
				controllerRef.current = null;
			}
		};
		// `handler` is intentionally omitted: `onEvent` (from useEffectEvent)
		// always calls the latest version without needing this effect to
		// re-run. `eventName` is intentionally omitted in favor of
		// `eventNamesStr` above, which only changes when the event names
		// themselves change, not on every unmemoized array literal.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [eventNamesStr, resolvedTarget, capture, passive, once, externalSignal]);

	return stop;
}

export { type UseEventListenerReturn, useEventListener };
