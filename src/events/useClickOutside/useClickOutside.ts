import { useRef } from "react";
import { useEventListener } from "../useEventListener/useEventListener.ts";
import type {
	ClickOutsideEvent,
	ClickOutsideTargetRef,
	UseClickOutsideOptions,
} from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/**
 * A function that detaches the listener registered by `useClickOutside`
 * immediately, without waiting for the component to unmount.
 *
 * Safe to call more than once. Note that this does not permanently disable
 * the hook: if `target`, `eventType`, `enabled`, or `capture` change
 * afterwards, a new listener may be attached again on the next render.
 */
type UseClickOutsideReturn = () => void;

/**
 * Calls `handler` when a click (or the configured event type) happens
 * outside of `target`.
 *
 * `target` may be a single element/ref, or an array of them — the handler
 * only fires when the click is outside *every* target in the array. An
 * unmounted target (a ref whose `current` is `null`) is treated as
 * "outside" for its own entry rather than blocking detection for the
 * others, so it's safe to pass refs that haven't attached yet.
 *
 * @param target The element(s) to detect clicks outside of. Accepts a ref, a direct
 * element, `null`, or an array mixing any of those.
 * @param handler Called with the native event when a click outside is detected. Doesn't
 * need to be memoized.
 * @param options See {@link UseClickOutsideOptions}.
 * @returns A function that detaches the listener on demand.
 *
 * @example
 * ```tsx
 * const modalRef = useRef<HTMLDivElement>(null);
 * useClickOutside(modalRef, () => setOpen(false));
 * ```
 *
 * @example
 * Checking outside multiple elements at once — for example, a dropdown that
 * shouldn't close when its own trigger button is clicked:
 * ```tsx
 * const triggerRef = useRef<HTMLButtonElement>(null);
 * const panelRef = useRef<HTMLDivElement>(null);
 * useClickOutside([triggerRef, panelRef], () => setOpen(false));
 * ```
 */
function useClickOutside(
	target: ClickOutsideTargetRef | ClickOutsideTargetRef[],
	handler: (event: ClickOutsideEvent) => void,
	options: UseClickOutsideOptions = {},
): UseClickOutsideReturn {
	const {
		enabled = true,
		eventType = ["mousedown", "touchstart"],
		capture = true,
	} = options;

	const hasWarnedEmptyTargetRef = useRef(false);

	const onClickOutside = (event: ClickOutsideEvent) => {
		const eventTarget = event.target;
		if (!(eventTarget instanceof Node)) return;

		const targets = Array.isArray(target) ? target : [target];

		// This runs on every click, so the warning is latched to fire once
		// rather than on every single click for the component's lifetime.
		if (isDev && targets.length === 0 && !hasWarnedEmptyTargetRef.current) {
			hasWarnedEmptyTargetRef.current = true;
			console.warn(
				"[useClickOutside] Called with an empty target array — every click will be treated as outside.",
			);
		}

		const isOutside = targets.every((t) => {
			const el = t && "current" in t ? t.current : t;

			// A target that isn't mounted yet has nothing to be "inside" of —
			// it should never block the outside determination for the others.
			if (!el) return true;

			return !el.contains(eventTarget);
		});

		if (isOutside) {
			handler(event);
		}
	};

	return useEventListener(eventType, onClickOutside, {
		// Gating via `target` (rather than an early-return inside the
		// handler) means the listener is fully detached when disabled, not
		// just a no-op.
		target: enabled && typeof document !== "undefined" ? document : null,
		capture,
		// Always passive: the handler never calls preventDefault(), and
		// passive touch listeners avoid blocking scroll performance.
		passive: true,
	});
}

export { type UseClickOutsideReturn, useClickOutside };
