export {
	type UseClickOutsideReturn,
	useClickOutside,
} from "./useClickOutside/useClickOutside";
export {
	type UseEventListenerReturn,
	useEventListener,
} from "./useEventListener/useEventListener";
export { type UseKeyReturn, useKey } from "./useKey/useKey";

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

export {
	formatKey,
	type FormatKeyDescriptor,
	type FormatKeyOptions,
} from "../shared/keysShared/utils";
