export {
	type UseClickOutsideReturn,
	useClickOutside,
} from "./useClickOutside/useClickOutside";
export {
	type UseEventListenerReturn,
	useEventListener,
} from "./useEventListener/useEventListener";
export { type UseKeyReturn, useKey } from "./useKey/useKey";
export { type UseHeldKeysReturn, useHeldKeys } from "./useHeldKeys/useHeldKeys";
export { type UseKeyHoldReturn, useKeyHold } from "./useKeyHold/useKeyHold";

export type {
	ClickOutsideEvent,
	ClickOutsideEventName,
	ClickOutsideTarget,
	ClickOutsideTargetRef,
	UseClickOutsideOptions,
} from "./useClickOutside/types";
export type {
	TargetRef,
	TargetType,
	UseEventListenerOptions,
} from "./useEventListener/types";
export type { KeyEventType, UseKeyBaseOptions, UseKeyOptions } from "./useKey/types";

export { formatKey } from "./formatKey/formatKey";
export type { FormatKeyDescriptor, FormatKeyOptions } from "./formatKey/types";

export type { CanonicalModifier, KeyModifiers } from "../shared/keysShared/types";
